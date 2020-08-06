import axios from 'axios'
import { User } from './entities/User'
import { Post, PostType } from './entities/Post'
import * as TypeORM from 'typeorm'
import { getRepository } from 'typeorm'
import * as argon2 from 'argon2'
// @ts-ignore
import isImageUrl from 'is-image-url'
import Mercury from '@postlight/mercury-parser'
import { getThumbnailUrl } from './thumbnail'
import sharp from 'sharp'
import { s3 } from './s3'
import { entities } from './EntitiesAndResolvers'
import { galaxiesList } from './galaxiesList'

const galaxyMap = {
  programming: galaxiesList.find((g) => g.name === 'programming'),
  science: galaxiesList.find((g) => g.name === 'science'),
  Games: galaxiesList.find((g) => g.name === 'gaming'),
  GameDeals: galaxiesList.find((g) => g.name === 'gaming'),
  movies: galaxiesList.find((g) => g.name === 'movies_tv'),
  television: galaxiesList.find((g) => g.name === 'movies_tv'),
  videos: galaxiesList.find((g) => g.name === 'videos_livestreams'),
  youtubehaiku: galaxiesList.find((g) => g.name === 'videos_livestreams'),
  news: galaxiesList.find((g) => g.name === 'news'),
  worldnews: galaxiesList.find((g) => g.name === 'news'),
  sports: galaxiesList.find((g) => g.name === 'sports'),
  InternetIsBeautiful: galaxiesList.find((g) => g.name === 'technology'),
  gadgets: galaxiesList.find((g) => g.name === 'technology'),
  Futurology: galaxiesList.find((g) => g.name === 'technology'),
  technology: galaxiesList.find((g) => g.name === 'technology'),
  indieheads: galaxiesList.find((g) => g.name === 'music'),
  hiphopheads: galaxiesList.find((g) => g.name === 'music'),
  listentothis: galaxiesList.find((g) => g.name === 'music'),
  Music: galaxiesList.find((g) => g.name === 'music')
}

const subreddits = Object.keys(galaxyMap)

async function redditReposter() {
  if (process.env.NODE_ENV !== 'production') {
    // DEV
    await TypeORM.createConnection({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'password',
      database: 'postgres',
      entities,
      synchronize: true,
      logging: true,
      cache: true,
      dropSchema: false
    })
  } else if (process.env.NODE_ENV === 'production' && !process.env.STAGING) {
    // PROD
    await TypeORM.createConnection({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities,
      synchronize: true,
      logging: false,
      cache: true
    })
  } else if (
    process.env.NODE_ENV === 'production' &&
    process.env.STAGING === 'true'
  ) {
    // STAGING
    await TypeORM.createConnection({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities,
      synchronize: true,
      logging: false,
      cache: true
    })
  } else return

  const userRepository = getRepository(User)
  const postRepository = getRepository(Post)

  let cometBot = await userRepository.findOne({ username: 'Comet' })
  if (!cometBot) {
    cometBot = await userRepository.save({
      username: 'Comet',
      createdAt: new Date(),
      profilePicUrl: 'https://i.getcomet.net/8TPU9H06p.png',
      passwordHash: await argon2.hash(process.env.COMET_BOT_PASSWORD),
      admin: true,
      bio: 'The official Comet bot.',
      tag: 'Bot',
      tagColor: 'red lighten-1'
    })
  }

  const headers = { 'User-Agent': 'getcomet.net reddit post saver' }

  let res

  try {
    res = await axios.get(
      `https://www.reddit.com/r/${subreddits.join('+')}/hot.json?limit=100`,
      { headers }
    )
  } catch (e) {
    console.error('Failed to retrieve reddit posts')
    return
  }

  const { data } = res

  let redditPosts = data.data.children
    .map((post: any) => post.data)
    .filter(
      (post: any) =>
        !post.selftext &&
        !post.url.startsWith('https://www.reddit.com') &&
        !post.url.startsWith('/r/')
    )

  const alreadySavedPostsIds = (
    await postRepository.findByIds(redditPosts.map((post: any) => post.id))
  ).map((post: any) => post.id)

  redditPosts = redditPosts.filter(
    (post: any) => !alreadySavedPostsIds.includes(post.id)
  )

  const postsToSave = await redditPosts.map(async (post: any) => {
    let parseResult: any = null
    let type
    let thumbnailUrl =
      post.thumbnail &&
      typeof post.thumbnail === 'string' &&
      post.thumbnail.startsWith('https://')
        ? post.thumbnail
        : null

    if (isImageUrl(post.url)) {
      parseResult = {
        lead_image_url: post.url
      }
      type = PostType.IMAGE
    } else {
      type = PostType.LINK
      if (!thumbnailUrl) {
        const longTask = () =>
          new Promise(async (resolve) => {
            try {
              resolve(await Mercury.parse(post.url))
            } catch (e) {
              resolve({})
            }
          })

        const timeout = (cb: any, interval: number) => () =>
          new Promise((resolve) => setTimeout(() => cb(resolve), interval))

        const onTimeout = timeout((resolve: any) => resolve({}), 10000)

        parseResult = await Promise.race([longTask, onTimeout].map((f) => f()))

        if (!parseResult.lead_image_url) {
          try {
            parseResult.lead_image_url = await getThumbnailUrl(post.url, 10000)
          } catch (e) {}
        }
      }
    }

    if (!thumbnailUrl && parseResult && parseResult.lead_image_url) {
      try {
        const response = await axios.get(parseResult.lead_image_url, {
          responseType: 'arraybuffer'
        })
        const resizedImage = await sharp(response.data)
          .resize(80, 60, {
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .jpeg()
          .toBuffer()

        thumbnailUrl = await new Promise((resolve, reject) =>
          s3.upload(
            {
              Bucket: 'i.getcomet.net',
              Key: `thumbs/${post.id}.jpg`,
              Body: resizedImage,
              ContentType: 'image/jpeg'
            },
            (err, data) => {
              if (err) reject(err)
              else resolve(data.Location.replace('s3.amazonaws.com/', ''))
            }
          )
        )
      } catch {}
    }

    return {
      id: post.id,
      title: post.title.replace(/&amp;/g, '&'),
      createdAt: new Date(),
      authorId: cometBot.id,
      thumbnailUrl,
      domain: post.domain,
      type,
      link: post.url,
      planet: {
        name: post.subreddit,
        description: post.subreddit,
        moderators: [{ id: cometBot.id }],
        creatorId: cometBot.id,
        createdAt: new Date(2020, 6, 28),
        galaxy: galaxyMap[post.subreddit]
      }
    } as Post
  })

  await postRepository.save(await Promise.all(postsToSave))
}

redditReposter()
