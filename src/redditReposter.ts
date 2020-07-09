import axios from 'axios'
import { User } from './entities/User'
import { Comment } from './entities/Comment'
import { Post, PostType } from './entities/Post'
import { PostEndorsement } from './entities/PostEndorsement'
import { CommentEndorsement } from './entities/CommentEndorsement'
import { Topic } from './entities/Topic'
import { PostView } from './entities/PostView'
import { ReplyNotification } from './entities/ReplyNotification'
import * as TypeORM from 'typeorm'
import { getRepository } from 'typeorm'
import * as argon2 from 'argon2'
// @ts-ignore
import isImageUrl from 'is-image-url'
import Mercury from '@postlight/mercury-parser'
import { getThumbnailUrl } from './thumbnail'
import sharp from 'sharp'
import { s3 } from './s3'

const entities = [
  User,
  Comment,
  Post,
  PostEndorsement,
  CommentEndorsement,
  Topic,
  PostView,
  ReplyNotification,
]

const subreddits = [
  'programming',
  'conspiracy',
  'Music',
  'science',
  'Games',
  'movies',
  'videos',
  'news',
  'television',
  'space',
  'worldnews',
  'sports',
  'InternetIsBeautiful',
  'gadgets',
  'Futurology',
  'listentothis',
  'technology',
  'indieheads',
  'hiphopheads',
  'greentext',
  '4chan',
]

function mapSubredditToTopics(subreddit: string): string[] {
  subreddit = subreddit.toLowerCase()
  if (subreddit === 'internetisbeautiful') return ['internet_is_beautiful']
  else if (subreddit === 'worldnews') return ['news']
  else if (subreddit === 'listentothis') return ['music']
  else if (subreddit === 'indieheads') return ['music', 'indie_music']
  else if (subreddit === 'hiphopheads') return ['music', 'hip_hop_music']
  else if (subreddit === 'gadgets') return ['technology', 'gadgets']
  else if (subreddit === 'greentext') return ['4chan']
  else return [subreddit]
}

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
      dropSchema: false,
    })
  } else if (process.env.NODE_ENV === 'production' && !process.env.STAGING) {
    // PROD
    await TypeORM.createConnection({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities,
      synchronize: true,
      logging: false,
      cache: true,
    })
  } else if (process.env.NODE_ENV === 'production' && process.env.STAGING === 'true') {
    // STAGING
    await TypeORM.createConnection({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities,
      synchronize: true,
      logging: false,
      cache: true,
    })
  } else return

  const userRepository = getRepository(User)
  const postRepository = getRepository(Post)
  const topicRepository = getRepository(Topic)

  let cometBot = await userRepository.findOne({ username: 'Comet' })
  if (!cometBot) {
    cometBot = await userRepository.save({
      username: 'Comet',
      createdAt: new Date(),
      profilePicUrl: 'https://i.getcomet.net/thumbs/YJT7aBjRk.jpg',
      passwordHash: await argon2.hash(process.env.COMET_BOT_PASSWORD),
      admin: true,
      bio: 'The official Comet bot.',
      tag: 'Bot',
      tagColor: 'blue',
    })
  }

  const headers = { 'User-Agent': 'getcomet.net reddit post saver' }

  const { data } = await axios.get(
    `https://www.reddit.com/r/${subreddits.join('+')}/hot.json?limit=100`,
    { headers },
  )

  let redditPosts = data.data.children
    .map((post: any) => post.data)
    .filter(
      (post: any) =>
        !post.selftext &&
        !post.url.startsWith('https://www.reddit.com') &&
        !post.url.startsWith('/r/'),
    )

  const alreadySavedPostsIds = (
    await postRepository.findByIds(redditPosts.map((post: any) => post.id))
  ).map((post: any) => post.id)

  redditPosts = redditPosts.filter((post: any) => !alreadySavedPostsIds.includes(post.id))

  let topicsToSave: any[] = []
  redditPosts.forEach((post: any) => {
    const mappedTopics = mapSubredditToTopics(post.subreddit).map((topicName: any) => ({
      name: topicName,
    }))
    topicsToSave.push(...mappedTopics)
  })
  topicsToSave = topicsToSave.filter(
    (topic, index, self) => index === self.findIndex(t => t.name === topic.name),
  )

  const postsToSave = await redditPosts.map(async (post: any) => {
    let parseResult: any = null
    let type = PostType.LINK
    let thumbnailUrl =
      post.thumbnail && typeof post.thumbnail === 'string' && post.thumbnail.startsWith('https://')
        ? post.thumbnail
        : null

    if (isImageUrl(post.url)) {
      parseResult = {
        // eslint-disable-next-line @typescript-eslint/camelcase
        lead_image_url: post.url,
      }
      type = PostType.IMAGE
    } else {
      type = PostType.LINK
      if (!thumbnailUrl) {
        const longTask = () =>
          new Promise(async resolve => {
            try {
              resolve(await Mercury.parse(post.url))
            } catch (e) {
              resolve({})
            }
          })

        const timeout = (cb: any, interval: number) => () =>
          new Promise(resolve => setTimeout(() => cb(resolve), interval))

        const onTimeout = timeout((resolve: any) => resolve({}), 3000)

        parseResult = await Promise.race([longTask, onTimeout].map(f => f()))

        if (!parseResult.lead_image_url) {
          try {
            // eslint-disable-next-line @typescript-eslint/camelcase
            parseResult.lead_image_url = await getThumbnailUrl(post.url)
          } catch (e) {}
        }
      }
    }

    if (!thumbnailUrl && parseResult && parseResult.lead_image_url) {
      let s3UploadLink = ''

      const response = await axios.get(parseResult.lead_image_url, { responseType: 'arraybuffer' })
      const isYoutube = parseResult.lead_image_url.includes('ytimg.com')
      const resizedImage = await sharp(response.data)
        .resize(isYoutube ? 128 : 72, 72, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .jpeg()
        .toBuffer()

      s3UploadLink = await new Promise((resolve, reject) =>
        s3.upload(
          {
            Bucket: 'i.getcomet.net',
            Key: `thumbs/${post.id}.jpg`,
            Body: resizedImage,
            ContentType: 'image/jpeg',
          },
          (err, data) => {
            if (err) reject(err)
            else resolve(data.Location.replace('s3.amazonaws.com/', ''))
          },
        ),
      )
      thumbnailUrl = s3UploadLink
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
      topicsarr: mapSubredditToTopics(post.subreddit),
      topics: mapSubredditToTopics(post.subreddit).map((topicName: any) => ({ name: topicName })),
    } as Post
  })

  await topicRepository.save(topicsToSave)
  await postRepository.save(await Promise.all(postsToSave))
}

redditReposter()
