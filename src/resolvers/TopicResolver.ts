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
  async topic(@Arg('topicName', type => ID) topicName: string) {
    return this.topicRepository
      .createQueryBuilder('topic')
      .andWhere('topic.name ILIKE :topicName', { topicName })
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
      .having('COUNT(posts.id) > 0')
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

  @UseMiddleware(RequiresAuth)
  @Mutation(returns => Boolean)
  async followTopic(@Arg('topicName', type => ID) topicName: string, @Ctx() { userId }: Context) {
    await this.userRepository
      .createQueryBuilder()
      .relation(User, 'followedTopics')
      .of(userId)
      .add(topicName)
    return true
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(returns => Boolean)
  async unfollowTopic(@Arg('topicName', type => ID) topicName: string, @Ctx() { userId }: Context) {
    await this.userRepository
      .createQueryBuilder()
      .relation(User, 'followedTopics')
      .of(userId)
      .remove(topicName)
    return true
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(returns => Boolean)
  async hideTopic(@Arg('topicName', type => ID) topicName: string, @Ctx() { userId }: Context) {
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
  async unhideTopic(@Arg('topicName', type => ID) topicName: string, @Ctx() { userId }: Context) {
    await this.userRepository
      .createQueryBuilder()
      .relation(User, 'hiddenTopics')
      .of(userId)
      .remove(topicName)
    return true
  }

  @FieldResolver()
  capitalizedName(@Root() topic: Topic) {
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
