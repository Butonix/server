import {
  Arg,
  Args,
  Ctx,
  FieldResolver,
  ID,
  Mutation,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from 'type-graphql'
import { RepositoryInjector } from '../RepositoryInjector'
import { Post, PostType } from '../entities/Post'
import { SubmitPostArgs } from '../args/SubmitPostArgs'
import { RequiresAuth } from '../RequiresAuth'
import { Context } from '../Context'
import shortid from 'shortid'
import Mercury from '@postlight/mercury-parser'
// @ts-ignore
import isImageUrl from 'is-image-url'
// @ts-ignore
import Url from 'url-parse'
import { Topic } from '../entities/Topic'
import { getThumbnailUrl } from '../thumbnail'
import { PostView } from '../entities/PostView'
// @ts-ignore
import getTitleAtUrl from 'get-title-at-url'
import { FeedArgs } from '../args/FeedArgs'
import AWS from 'aws-sdk'
import axios from 'axios'
import sharp from 'sharp'

const s3 = new AWS.S3({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

@Resolver(of => Post)
export class PostResolver extends RepositoryInjector {
  @Query(returns => String)
  async getTitleAtUrl(@Arg('url') url: string) {
    return await new Promise(resolve => {
      getTitleAtUrl(url, (title: any) => resolve(title ? title : ''))
    })
  }

  @Query(returns => [Post])
  async homeFeed(@Args() { page, pageSize, sort, time }: FeedArgs, @Ctx() { userId }: Context) {
    console.log('---------------------------homeFeed---------------------------')

    const qb = this.postRepository
      .createQueryBuilder('post')
      .addOrderBy('post.createdAt', 'DESC')
      .andWhere('post.deleted = false')
      .leftJoinAndSelect('post.topics', 'topic')
      .skip(page * pageSize)
      .take(pageSize)
      .loadRelationCountAndMap('post.commentCount', 'post.comments')

    if (userId) {
      qb.loadRelationCountAndMap(
        'post.personalEndorsementCount',
        'post.endorsements',
        'endorsement',
        qb => {
          return qb
            .andWhere('endorsement.active = true')
            .andWhere('endorsement.userId = :userId', { userId })
        },
      )
    }
    const posts = await qb.getMany()

    posts.forEach(post => (post.isEndorsed = Boolean(post.personalEndorsementCount)))

    return posts
  }

  @Query(returns => Post)
  async post(@Arg('postId', type => ID) postId: string, @Ctx() { userId }: Context) {
    console.log('---------------------------post---------------------------')

    const qb = this.postRepository
      .createQueryBuilder('post')
      .where('post.id = :postId', { postId })
      .loadRelationCountAndMap('post.commentCount', 'post.comments')

    if (userId) {
      qb.loadRelationCountAndMap(
        'post.personalEndorsementCount',
        'post.endorsements',
        'endorsement',
        qb => {
          return qb
            .andWhere('endorsement.active = true')
            .andWhere('endorsement.userId = :userId', { userId })
        },
      )
    }

    const post = await qb.leftJoinAndSelect('post.topics', 'topic').getOne()

    if (!post) throw new Error('Invalid post ID')

    post.isEndorsed = Boolean(post.personalEndorsementCount)

    return post
  }

  @Mutation(returns => PostView, { nullable: true })
  async recordPostView(@Arg('postId', type => ID) postId: string, @Ctx() { userId }: Context) {
    console.log('---------------------------postView---------------------------')

    if (!userId) return null

    let postView = await this.postViewRepository.findOne({ postId, userId })

    const post = await this.postRepository
      .createQueryBuilder('post')
      .andWhereInIds(postId)
      .loadRelationCountAndMap('post.commentCount', 'post.comments')
      .getOne()

    if (!post) throw new Error('Invalid post id')

    if (postView) {
      await this.postViewRepository.update({ userId, postId }, {
        createdAt: new Date(),
        lastCommentCount: post.commentCount,
      } as PostView)
    } else {
      postView = await this.postViewRepository.save({
        createdAt: new Date(),
        userId,
        postId,
        lastCommentCount: post.commentCount,
      } as PostView)
    }

    return postView
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(returns => Post)
  async submitPost(
    @Args() { title, type, link, textContent, topics }: SubmitPostArgs,
    @Ctx() { userId }: Context,
  ) {
    console.log('---------------------------submitPost---------------------------')

    const url = new Url(link)
    let parseResult: any = null
    if (type === PostType.LINK) {
      if (isImageUrl(link)) {
        parseResult = {
          // eslint-disable-next-line @typescript-eslint/camelcase
          lead_image_url: link,
        }
      } else {
        const longTask = () =>
          new Promise(async resolve => {
            try {
              resolve(await Mercury.parse(link))
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
            parseResult.lead_image_url = await getThumbnailUrl(link)
          } catch (e) {}
        }
      }
      parseResult.domain = url.hostname
    }

    const postId = shortid.generate()
    let s3UploadLink = ''

    if (type === PostType.LINK && parseResult && parseResult.lead_image_url) {
      const response = await axios.get(parseResult.lead_image_url, { responseType: 'arraybuffer' })
      const isYoutube = parseResult.lead_image_url.includes('ytimg.com')
      const resizedImage = await sharp(response.data)
        .resize(isYoutube ? 128 : 72, 72)
        .jpeg()
        .toBuffer()

      s3UploadLink = await new Promise((resolve, reject) =>
        s3.upload(
          { Bucket: 'comet-thumbs', Key: `${postId}.jpeg`, Body: resizedImage },
          (err, data) => {
            if (err) reject(err)
            else resolve(data.Location)
          },
        ),
      )
    }

    const savedTopics = await this.topicRepository.save(
      topics.map(topic => ({ name: topic.toLowerCase().replace(/ /g, '_') } as Topic)),
    )

    return this.postRepository.save({
      id: postId,
      title,
      type,
      link,
      textContent,
      createdAt: new Date(),
      authorId: userId,
      thumbnailUrl: s3UploadLink ? s3UploadLink : undefined,
      domain: parseResult ? parseResult.domain.replace('www.', '') : undefined,
      topics: savedTopics,
    } as Post)
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(returns => Boolean)
  async deletePost(@Arg('postId', type => ID) postId: string, @Ctx() { userId }: Context) {
    console.log('---------------------------deletePost---------------------------')

    const post = await this.postRepository.findOne({ id: postId })
    if (post.authorId !== userId)
      throw new Error('Attempt to delete post by someone other than author')

    await this.postRepository
      .createQueryBuilder()
      .update()
      .set({ deleted: true })
      .where('id = :postId', { postId })
      .execute()

    return true
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(returns => Boolean)
  async togglePostEndorsement(
    @Arg('postId', type => ID) postId: string,
    @Ctx() { userId }: Context,
  ) {
    console.log('---------------------------togglePostEndorsement---------------------------')

    const post = await this.postRepository
      .createQueryBuilder('post')
      .whereInIds(postId)
      .leftJoinAndSelect('post.author', 'author')
      .getOne()
    if (!post) throw new Error('Invalid postId')

    if (userId === post.authorId) throw new Error('Cannot endorse your own post')

    let active: boolean

    const endorsement = await this.postEndorsementRepository.findOne({ postId, userId })
    if (endorsement) {
      await this.postEndorsementRepository.update(
        { postId, userId },
        { active: !endorsement.active },
      )
      active = !endorsement.active
    } else {
      await this.postEndorsementRepository.save({
        postId,
        userId,
        createdAt: new Date(),
        active: true,
      })
      active = true
    }

    this.postRepository.update(
      { id: postId },
      { endorsementCount: active ? post.endorsementCount + 1 : post.endorsementCount - 1 },
    )

    const author = await post.author
    this.userRepository.update(
      { id: author.id },
      { endorsementCount: active ? author.endorsementCount + 1 : author.endorsementCount - 1 },
    )

    return active
  }

  @FieldResolver()
  async author(@Root() post: Post, @Ctx() { userLoader }: Context) {
    return userLoader.load(post.authorId)
  }

  @FieldResolver()
  async postView(@Root() post: Post, @Ctx() { postViewLoader, userId }: Context) {
    return postViewLoader.load({ postId: post.id, userId })
  }

  @FieldResolver()
  async newCommentCount(@Root() post: Post, @Ctx() { userId }: Context) {
    if (!userId) return -1
    if (!post.postView) return -1
    return post.commentCount - post.postView.lastCommentCount
  }
}
