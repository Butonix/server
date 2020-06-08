import {
  Arg,
  Args,
  Ctx,
  FieldResolver,
  ID,
  Int,
  Mutation,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from 'type-graphql'
import { Context } from '../Context'
import { User } from '../entities/User'
import { RequiresAuth } from '../RequiresAuth'
import { Comment } from '../entities/Comment'
import { UserCommentsArgs } from '../args/UserCommentsArgs'
import { RepositoryInjector } from '../RepositoryInjector'
import { Post } from '../entities/Post'

@Resolver(of => User)
export class UserResolver extends RepositoryInjector {
  @Query(returns => User, { nullable: true })
  async currentUser(@Ctx() { userId }: Context) {
    if (!userId) {
      return null
    }

    console.log('---------------------------currentUser---------------------------')

    return this.userRepository
      .createQueryBuilder('user')
      .whereInIds(userId)
      .getOne()
  }

  @Query(returns => User, { nullable: true })
  async user(@Arg('username') username: string) {
    console.log('---------------------------user---------------------------')

    return this.userRepository
      .createQueryBuilder('user')
      .where('user.username = :username', { username })
      .loadRelationCountAndMap('user.followerCount', 'user.followers')
      .loadRelationCountAndMap('user.commentCount', 'user.comments', 'comment', qb => {
        return qb.andWhere('comment.deleted = false')
      })
      .loadRelationCountAndMap('user.postCount', 'user.posts', 'post', qb => {
        return qb.andWhere('post.deleted = false')
      })
      .getOne()
  }

  @Query(returns => [Comment])
  async userComments(
    @Args() { username, page, pageSize }: UserCommentsArgs,
    @Ctx() { userId }: Context,
  ) {
    console.log('---------------------------userComments---------------------------')

    const user = await this.userRepository.findOne({ username })

    if (!user) throw new Error('User not found')

    const qb = this.commentRepository
      .createQueryBuilder('comment')
      .where('comment.authorId = :id', { id: user.id })
      .andWhere('comment.deleted = false')
      .addOrderBy('comment.createdAt', 'DESC')
      .skip(page * pageSize)
      .take(pageSize)

    if (userId) {
      qb.loadRelationCountAndMap(
        'comment.personalEndorsementCount',
        'comment.endorsements',
        'endorsement',
        qb => {
          return qb
            .andWhere('endorsement.active = true')
            .andWhere('endorsement.userId = :userId', { userId })
        },
      )
    }

    const comments = await qb.getMany()

    comments.forEach(comment => (comment.isEndorsed = Boolean(comment.personalEndorsementCount)))

    return comments
  }

  @Query(returns => [Post])
  async userPosts(
    @Args() { username, page, pageSize }: UserCommentsArgs,
    @Ctx() { userId }: Context,
  ) {
    console.log('---------------------------userPosts---------------------------')

    const user = await this.userRepository.findOne({ username })

    if (!user) throw new Error('User not found')

    const qb = this.postRepository
      .createQueryBuilder('post')
      .where('post.authorId = :id', { id: user.id })
      .loadRelationCountAndMap('post.commentCount', 'post.comments')
      .addOrderBy('post.createdAt', 'DESC')
      .andWhere('post.deleted = false')
      .skip(page * pageSize)
      .take(pageSize)

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

  @UseMiddleware(RequiresAuth)
  @Mutation(returns => Boolean)
  async followUser(@Arg('followedId', type => ID) followedId: string, @Ctx() { userId }: Context) {
    if (followedId === userId) {
      throw new Error('Cannot follow yourself')
    }

    console.log('---------------------------followUser---------------------------')

    await this.userRepository
      .createQueryBuilder()
      .relation(User, 'following')
      .of(userId)
      .add(followedId)

    return true
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(returns => Boolean)
  async unfollowUser(
    @Arg('followedId', type => ID) followedId: string,
    @Ctx() { userId }: Context,
  ) {
    if (followedId === userId) {
      throw new Error('Cannot unfollow yourself')
    }

    console.log('---------------------------unfollowUser---------------------------')

    await this.userRepository
      .createQueryBuilder()
      .relation(User, 'following')
      .of(userId)
      .remove(followedId)

    return true
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(returns => Boolean)
  async blockUser(@Arg('blockedId', type => ID) blockedId: string, @Ctx() { userId }: Context) {
    if (blockedId === userId) {
      throw new Error('Cannot block yourself')
    }

    console.log('---------------------------blockUser---------------------------')

    await this.userRepository
      .createQueryBuilder('user')
      .relation(User, 'blockedUsers')
      .of(userId)
      .add(blockedId)
    return true
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(returns => Boolean)
  async unblockUser(@Arg('blockedId', type => ID) blockedId: string, @Ctx() { userId }: Context) {
    if (blockedId === userId) {
      throw new Error('Cannot unblock yourself')
    }

    console.log('---------------------------unblockUser---------------------------')

    await this.userRepository
      .createQueryBuilder('user')
      .relation(User, 'blockedUsers')
      .of(userId)
      .remove(blockedId)
    return true
  }

  @FieldResolver(returns => Boolean)
  async isFollowing(@Root() user: User, @Ctx() { userId }: Context) {
    if (!userId) return false

    console.log('---------------------------isFollowing---------------------------')

    user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId: userId })
      .leftJoinAndSelect('user.following', 'targetUser', 'targetUser.id = :targetId', {
        targetId: user.id,
      })
      .getOne()

    return Boolean((await user.following).length)
  }

  @FieldResolver(returns => Boolean)
  async isFollowed(@Root() user: User, @Ctx() { userId }: Context) {
    if (!userId) return false

    console.log('---------------------------isFollowed---------------------------')

    user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId: user.id })
      .leftJoinAndSelect('user.following', 'targetUser', 'targetUser.id = :targetId', {
        targetId: userId,
      })
      .getOne()

    return Boolean((await user.following).length)
  }

  @FieldResolver(returns => Boolean)
  async isBlocked(@Root() user: User, @Ctx() { userId }: Context) {
    if (!userId) return false

    console.log('---------------------------isBlocked---------------------------')

    user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId: user.id })
      .leftJoinAndSelect('user.blockedUsers', 'targetUser', 'targetUser.id = :targetId', {
        targetId: userId,
      })
      .getOne()

    return Boolean((await user.blockedUsers).length)
  }

  @FieldResolver(returns => Boolean)
  async isBlocking(@Root() user: User, @Ctx() { userId }: Context) {
    if (!userId) return false

    console.log('---------------------------isBlocking---------------------------')

    user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId: userId })
      .leftJoinAndSelect('user.blockedUsers', 'targetUser', 'targetUser.id = :targetId', {
        targetId: user.id,
      })
      .getOne()

    return Boolean((await user.blockedUsers).length)
  }

  @FieldResolver(returns => Boolean)
  async isCurrentUser(@Root() user: User, @Ctx() { userId }: Context) {
    return user.id === userId
  }
}
