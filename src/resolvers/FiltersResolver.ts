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

    const users = await this.userRepository
      .createQueryBuilder()
      .relation(User, 'blockedUsers')
      .of(userId)
      .loadMany()

    users.forEach(user => (user.isBlocking = true))

    return users
  }
}
