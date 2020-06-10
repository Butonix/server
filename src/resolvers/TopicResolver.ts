import {
  Arg,
  Args,
  Ctx,
  FieldResolver,
  Mutation,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from 'type-graphql'
import { Topic } from '../entities/Topic'
import { RequiresAuth } from '../RequiresAuth'
import { Context } from '../Context'
import { User } from '../entities/User'
import { RepositoryInjector } from '../RepositoryInjector'
import { Like } from 'typeorm'
import { PaginationArgs } from '../args/PaginationArgs'
import { Post } from '../entities/Post'
import { FeedArgs, Filter, Sort, Time, Type } from '../args/FeedArgs'
import { TopicFeedArgs } from '../args/TopicFeedArgs'

@Resolver(of => Topic)
export class TopicResolver extends RepositoryInjector {
  @Query(returns => Topic, { nullable: true })
  async topic(@Arg('topicName') topicName: string) {
    return this.topicRepository
      .createQueryBuilder('topic')
      .andWhere('topic.name = :topicName', { topicName })
      .loadRelationCountAndMap('topic.postCount', 'topic.posts', 'post', qb => {
        return qb.andWhere('post.deleted = false')
      })
      .loadRelationCountAndMap('topic.followerCount', 'topic.followers')
      .getOne()
  }

  @Query(returns => [Topic])
  async popularTopics() {
    const topics = await this.topicRepository
      .createQueryBuilder('topic')
      .addSelect('COUNT(posts.id)', 'topic_total')
      .leftJoin(
        'topic.posts',
        'posts',
        "posts.deleted = false AND posts.createdAt > NOW() - INTERVAL '1 day'",
      )
      .groupBy('topic.name')
      .orderBy('topic_total', 'DESC')
      .take(10)
      .getMany()

    topics.forEach(topic => (topic.postCount = topic.total))

    return topics
  }

  @Query(returns => [Topic])
  async searchTopics(@Arg('search') search: string) {
    if (!search) return []

    return this.topicRepository
      .createQueryBuilder('topic')
      .where('topic.name LIKE :name', { name: search.toLowerCase().replace(/ /g, '_') + '%' })
      .take(10)
      .getMany()
  }

  @Query(returns => [Topic])
  async followedTopics(@Ctx() { userId }: Context) {
    if (!userId) return []

    let topics = await this.userRepository
      .createQueryBuilder()
      .relation(User, 'followedTopics')
      .of(userId)
      .loadMany()

    if (topics.length === 0) return []

    topics = await this.topicRepository
      .createQueryBuilder('topic')
      .whereInIds(topics.map(topic => topic.name))
      .addOrderBy('topic.name', 'ASC')
      .loadRelationCountAndMap('topic.postCount', 'topic.posts', 'post', qb => {
        return qb
          .andWhere('post.deleted = false')
          .andWhere("post.createdAt > NOW() - INTERVAL '1 day'")
      })
      .getMany()

    return topics
  }

  @Query(returns => [Post])
  async topicFeed(
    @Args() { page, pageSize, sort, time, type, topicName }: TopicFeedArgs,
    @Ctx() { userId }: Context,
  ) {
    const qb = this.postRepository
      .createQueryBuilder('post')
      .andWhere('post.deleted = false')
      .andWhere(':topicName = ANY(post.topicsarr)', { topicName })

    if (type === Type.TEXT) {
      qb.andWhere("post.type = 'TEXT'")
    } else if (type === Type.LINK) {
      qb.andWhere("post.type = 'LINK'")
    }

    if (sort === Sort.NEW) {
      qb.addOrderBy('post.createdAt', 'DESC')
    } else if (sort === Sort.HOT) {
      qb.addSelect(
        'CAST(post.endorsementCount AS float)/((CAST((CAST(EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) AS int) - CAST(EXTRACT(EPOCH FROM post.createdAt) AS int)+100000) AS FLOAT)/6.0)^(1.0/3.0))',
        'post_hotrank',
      )
      qb.addOrderBy('post_hotrank', 'DESC')
    } else if (sort === Sort.TOP) {
      switch (time) {
        case Time.HOUR:
          qb.andWhere("post.createdAt > NOW() - INTERVAL '1 hour'")
          break
        case Time.DAY:
          qb.andWhere("post.createdAt > NOW() - INTERVAL '1 day'")
          break
        case Time.WEEK:
          qb.andWhere("post.createdAt > NOW() - INTERVAL '1 week'")
          break
        case Time.MONTH:
          qb.andWhere("post.createdAt > NOW() - INTERVAL '1 month'")
          break
        case Time.YEAR:
          qb.andWhere("post.createdAt > NOW() - INTERVAL '1 year'")
          break
        case Time.ALL:
          break
        default:
          break
      }
      qb.addOrderBy('post.endorsementCount', 'DESC')
      qb.addOrderBy('post.createdAt', 'DESC')
    }

    if (userId) {
      const user = await this.userRepository
        .createQueryBuilder('user')
        .whereInIds(userId)
        .leftJoinAndSelect('user.hiddenTopics', 'hiddenTopics')
        .leftJoinAndSelect('user.blockedUsers', 'blockedUsers')
        .leftJoinAndSelect('user.hiddenPosts', 'hiddenPosts')
        .getOne()

      const hiddenTopics = (await user.hiddenTopics).map(topic => topic.name)
      const blockedUsers = (await user.blockedUsers).map(user => user.id)
      const hiddenPosts = (await user.hiddenPosts).map(post => post.id)

      if (hiddenTopics.length > 0) {
        qb.andWhere(
          'COALESCE(ARRAY_LENGTH(ARRAY(SELECT UNNEST(:hiddenTopics::text[]) INTERSECT SELECT UNNEST(post.topicsarr::text[])), 1), 0) = 0',
        ).setParameter('hiddenTopics', hiddenTopics)
      }

      qb.andWhere('NOT (post.authorId = ANY(:blockedUsers))', { blockedUsers })

      qb.andWhere('NOT (post.id = ANY(:hiddenPosts))', { hiddenPosts })

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

    const posts = await qb
      .skip(page * pageSize)
      .take(pageSize)
      .leftJoinAndSelect('post.topics', 'topic')
      .loadRelationCountAndMap('post.commentCount', 'post.comments')
      .getMany()

    posts.forEach(post => (post.isEndorsed = Boolean(post.personalEndorsementCount)))

    return posts
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(returns => Boolean)
  async followTopic(@Arg('topicName') topicName: string, @Ctx() { userId }: Context) {
    await this.userRepository
      .createQueryBuilder()
      .relation(User, 'followedTopics')
      .of(userId)
      .add(topicName)
    return true
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(returns => Boolean)
  async unfollowTopic(@Arg('topicName') topicName: string, @Ctx() { userId }: Context) {
    await this.userRepository
      .createQueryBuilder()
      .relation(User, 'followedTopics')
      .of(userId)
      .remove(topicName)
    return true
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(returns => Boolean)
  async hideTopic(@Arg('topicName') topicName: string, @Ctx() { userId }: Context) {
    await this.userRepository
      .createQueryBuilder()
      .relation(User, 'followedTopics')
      .of(userId)
      .remove(topicName)

    await this.userRepository
      .createQueryBuilder()
      .relation(User, 'hiddenTopics')
      .of(userId)
      .add(topicName)
    return true
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(returns => Boolean)
  async unhideTopic(@Arg('topicName') topicName: string, @Ctx() { userId }: Context) {
    await this.userRepository
      .createQueryBuilder()
      .relation(User, 'hiddenTopics')
      .of(userId)
      .remove(topicName)
    return true
  }

  @FieldResolver()
  async capitalizedName(@Root() topic: Topic) {
    return topic.name
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.substring(1).toLowerCase())
      .join(' ')
  }

  @FieldResolver()
  async isFollowing(@Root() topic: Topic, @Ctx() { userId }: Context) {
    if (!userId) return false

    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId: userId })
      .leftJoinAndSelect('user.followedTopics', 'followedTopic', 'followedTopic.name = :name', {
        name: topic.name,
      })
      .getOne()

    return Boolean((await user.followedTopics).length)
  }

  @FieldResolver()
  async isHidden(@Root() topic: Topic, @Ctx() { userId }: Context) {
    if (!userId) return false

    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId: userId })
      .leftJoinAndSelect('user.hiddenTopics', 'hiddenTopic', 'hiddenTopic.name = :name', {
        name: topic.name,
      })
      .getOne()

    return Boolean((await user.hiddenTopics).length)
  }
}
