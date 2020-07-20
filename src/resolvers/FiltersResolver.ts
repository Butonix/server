import { Ctx, Query, Resolver, UseMiddleware } from 'type-graphql'
import { RepositoryInjector } from '../RepositoryInjector'
import { Context } from '../Context'
import { RequiresAuth } from '../RequiresAuth'
import { Topic } from '../entities/Topic'
import { User } from '../entities/User'

@Resolver()
export class FiltersResolver extends RepositoryInjector {
  @Query(returns => [Topic])
  async hiddenTopics(@Ctx() { userId }: Context) {
    if (!userId) return []

    const topics = await this.userRepository
      .createQueryBuilder()
      .relation(User, 'hiddenTopics')
      .of(userId)
      .loadMany()

    topics.forEach(topic => (topic.isHidden = true))

    return topics
  }

  @Query(returns => [User])
  async blockedUsers(@Ctx() { userId }: Context) {
    if (!userId) return []

    const blockedUsers = await this.userRepository
      .createQueryBuilder()
      .relation(User, 'blockedUsers')
      .of(userId)
      .loadMany()

    if (blockedUsers.length === 0) return []

    const blockedUsersIds = blockedUsers.map(u => u.id)

    const users = await this.userRepository
      .createQueryBuilder('user')
      .whereInIds(blockedUsersIds)
      .andWhere('user.banned = false')
      .loadRelationCountAndMap('user.followerCount', 'user.followers')
      .loadRelationCountAndMap('user.commentCount', 'user.comments', 'comment', qb => {
        return qb.andWhere('comment.deleted = false')
      })
      .loadRelationCountAndMap('user.postCount', 'user.posts', 'post', qb => {
        return qb.andWhere('post.deleted = false')
      })
      .getMany()

    users.forEach(user => (user.isBlocking = true))

    return users
  }
}
