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
  async popularTopics(@Args() { page, pageSize }: PaginationArgs) {
    const topics = await this.topicRepository
      .createQueryBuilder('topic')
      .skip(page * pageSize)
      .take(pageSize)
      .loadRelationCountAndMap('topic.postCount', 'topic.posts', 'post', qb => {
        return qb.andWhere('post.deleted = false')
      })
      .getMany()

    return topics.sort((a, b) => b.postCount - a.postCount)
  }

  @Query(returns => [Topic])
  async searchTopics(@Arg('search') search: string) {
    if (!search) return []

    return this.topicRepository.find({
      name: Like(search.toLowerCase().replace(/ /g, '_') + '%'),
    })
  }

  @Query(returns => [Topic])
  async followedTopics(@Ctx() { userId }: Context) {
    if (!userId) return []

    const topics = await this.userRepository
      .createQueryBuilder()
      .relation(User, 'followedTopics')
      .of(userId)
      .loadMany()

    return topics.sort((a, b) => a.name.localeCompare(b.name))
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
