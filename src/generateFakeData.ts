/*
// @ts-ignore
import Url from 'url-parse'
import { User } from './entities/User'
import { Post, PostType } from './entities/Post'
import { Comment } from './entities/Comment'
import * as argon2 from 'argon2'
import faker from 'faker'
import { Topic } from './entities/Topic'
import shortid from 'shortid'
import { Repository, TreeRepository } from 'typeorm'
import { randomAvataaarUrl } from './avataaars/randomAvataaar'

export class FakeDataGenerator {
  async generateFakeData(
    amount: number,
    userRepository: Repository<User>,
    postRepository: Repository<Post>,
    topicRepository: Repository<Topic>,
    commentRepository: TreeRepository<Comment>
  ) {
    if (
      process.env.NODE_ENV !== 'production' ||
      process.env.STAGING === 'true'
    ) {
      const usersToSave: User[] = []
      const postsToSave: Post[] = []
      let topicsToSave: any[] = []
      const commentsToSave: Comment[] = []
      const passwordHash = await argon2.hash('password')
      for (let i = 0; i < amount; i++) {
        const user = await userRepository.create({
          id: faker.random.uuid(),
          username: faker.internet.userName(),
          createdAt: faker.date.recent(),
          profilePicUrl: randomAvataaarUrl(),
          passwordHash
        })
        usersToSave.push(user)

        let type = PostType.TEXT
        let link = undefined
        let textContent = undefined
        let thumbnailUrl = undefined
        let domain = undefined
        const randNumber = faker.random.number({ min: 0, max: 2 })
        if (randNumber === 0) {
          type = PostType.TEXT
          textContent = faker.lorem.paragraphs(2)
        } else if (randNumber === 1) {
          type = PostType.LINK
          link = faker.internet.url()
        } else if (randNumber === 2) {
          type = PostType.IMAGE
          link = faker.image.imageUrl()
        }
        if (link) {
          thumbnailUrl = 'https://i.getcomet.net/thumbs/YJT7aBjRk.jpg'
          domain = new Url(link).hostname
        }

        const topicsarr = []
        for (let i = 0; i <= randNumber; i++) {
          topicsarr.push(faker.random.word().toLowerCase())
        }

        const topics = topicsarr.map((t) => ({ name: t } as Topic))
        topicsToSave.push(...topics)

        const post = await postRepository.create({
          id: shortid.generate(),
          authorId: user.id,
          title: faker.lorem.sentence(),
          type,
          link,
          domain,
          textContent,
          createdAt: faker.date.recent(),
          topics,
          topicsarr,
          thumbnailUrl
        })
        postsToSave.push(post)

        for (let i = 0; i <= randNumber; i++) {
          const comment = await commentRepository.create({
            id: shortid.generate(),
            postId: post.id,
            authorId: user.id,
            textContent: faker.lorem.paragraphs(2),
            createdAt: faker.date.recent()
          })
          commentsToSave.push(comment)
        }
      }
      await userRepository.save(usersToSave)
      topicsToSave = topicsToSave.filter(
        (topic, index, self) =>
          index === self.findIndex((t) => t.name === topic.name)
      )
      await topicRepository.save(topicsToSave)
      await postRepository.save(postsToSave)
      await commentRepository.save(commentsToSave)
    } else
      throw new Error(
        'generateFakeData can only be used in development and staging environments.'
      )
  }
}
*/
