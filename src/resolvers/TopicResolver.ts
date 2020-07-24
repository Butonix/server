import { Resolver } from 'type-graphql'
import { RepositoryInjector } from '../RepositoryInjector'
import { Planet } from '../entities/Planet'

@Resolver(() => Planet)
export class TopicResolver extends RepositoryInjector {
  /*@Query(() => [Topic])
  async popularTopics() {
    const topics = await this.topicRepository
      .createQueryBuilder('topic')
      .addSelect('COUNT(posts.id)', 'topic_total')
      .leftJoin(
        'topic.posts',
        'posts',
        "posts.deleted = false AND posts.createdAt > NOW() - INTERVAL '1 day'"
      )
      .groupBy('topic.name')
      .orderBy('topic_total', 'DESC')
      .having('COUNT(posts.id) > 0')
      .take(10)
      .getMany()

    topics.forEach((topic) => (topic.postCount = topic.total))

    return topics
  }*/
  /*@Query(() => [Topic])
  async searchTopics(@Arg('search') search: string) {
    if (!search) return []

    return this.topicRepository
      .createQueryBuilder('topic')
      .where('topic.name LIKE :name', {
        name: search.toLowerCase().replace(/ /g, '_') + '%'
      })
      .take(10)
      .getMany()
  }*/
  /*@Query(() => [Topic])
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
      .whereInIds(topics.map((topic) => topic.name))
      .addOrderBy('topic.name', 'ASC')
      .loadRelationCountAndMap(
        'topic.postCount',
        'topic.posts',
        'post',
        (qb) => {
          return qb
            .andWhere('post.deleted = false')
            .andWhere("post.createdAt > NOW() - INTERVAL '1 day'")
        }
      )
      .getMany()

    return topics
  }*/
}
