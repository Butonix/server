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
  UseMiddleware
} from 'type-graphql'
import { Context } from '../Context'
import { User } from '../entities/User'
import { RequiresAuth } from '../RequiresAuth'
import { Comment } from '../entities/Comment'
import { CommentSort, UserCommentsArgs } from '../args/UserCommentsArgs'
import { RepositoryInjector } from '../RepositoryInjector'
import { Time } from '../args/FeedArgs'

@Resolver(() => User)
export class UserResolver extends RepositoryInjector {
  @Query(() => User, { nullable: true })
  async currentUser(@Ctx() { userId, req }: Context) {
    if (!userId) {
      return null
    }

    const user = await this.userRepository
      .createQueryBuilder('user')
      .whereInIds(userId)
      .andWhere('user.banned = false')
      .getOne()

    if (user) {
      const lastLogin = new Date()
      user.lastLogin = lastLogin
      let ipAddresses = user.ipAddresses
      ipAddresses.unshift(req.ip)
      ipAddresses = [...new Set(ipAddresses)]
      this.userRepository.update(user.id, { lastLogin, ipAddresses })
    }

    return user
  }

  @Query(() => User, { nullable: true })
  async user(@Arg('username') username: string) {
    if (!username) return null

    return this.userRepository
      .createQueryBuilder('user')
      .where('user.username ILIKE :username', {
        username: username.replace(/_/g, '\\_')
      })
      .andWhere('user.banned = false')
      .loadRelationCountAndMap('user.followerCount', 'user.followers')
      .loadRelationCountAndMap(
        'user.commentCount',
        'user.comments',
        'comment',
        (qb) => {
          return qb.andWhere('comment.deleted = false')
        }
      )
      .loadRelationCountAndMap('user.postCount', 'user.posts', 'post', (qb) => {
        return qb.andWhere('post.deleted = false')
      })
      .getOne()
  }

  @Query(() => [Comment])
  async userComments(
    @Args() { username, page, pageSize, sort, time }: UserCommentsArgs,
    @Ctx() { userId }: Context
  ) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.username ILIKE :username', {
        username: username.replace(/_/g, '\\_')
      })
      .getOne()

    if (!user) return []

    const qb = this.commentRepository
      .createQueryBuilder('comment')
      .andWhere('comment.authorId = :id', { id: user.id })
      .andWhere('comment.deleted = false')
      .skip(page * pageSize)
      .take(pageSize)

    if (sort === CommentSort.TOP) {
      switch (time) {
        case Time.HOUR:
          qb.andWhere("comment.createdAt > NOW() - INTERVAL '1 hour'")
          break
        case Time.DAY:
          qb.andWhere("comment.createdAt > NOW() - INTERVAL '1 day'")
          break
        case Time.WEEK:
          qb.andWhere("comment.createdAt > NOW() - INTERVAL '1 week'")
          break
        case Time.MONTH:
          qb.andWhere("comment.createdAt > NOW() - INTERVAL '1 month'")
          break
        case Time.YEAR:
          qb.andWhere("comment.createdAt > NOW() - INTERVAL '1 year'")
          break
        case Time.ALL:
          break
        default:
          break
      }
      qb.addOrderBy('comment.endorsementCount', 'DESC')
    }
    qb.addOrderBy('comment.createdAt', 'DESC')

    if (userId) {
      qb.loadRelationCountAndMap(
        'comment.personalEndorsementCount',
        'comment.endorsements',
        'endorsement',
        (qb) => {
          return qb
            .andWhere('endorsement.active = true')
            .andWhere('endorsement.userId = :userId', { userId })
        }
      )
    }

    const comments = await qb.getMany()

    comments.forEach(
      (comment) =>
        (comment.isEndorsed = Boolean(comment.personalEndorsementCount))
    )

    return comments
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(() => Boolean)
  async setProfilePicUrl(
    @Arg('profilePicUrl') profilePicUrl: string,
    @Ctx() { userId }: Context
  ) {
    if (
      !(
        profilePicUrl.startsWith('https://i.getcomet.net/profile') ||
        profilePicUrl.startsWith('https://api.getcomet.net/avataaar')
      )
    ) {
      throw new Error('Invalid URL')
    }
    await this.userRepository.update(userId, { profilePicUrl })
    return true
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(() => Boolean)
  async setBio(@Arg('bio') bio: string, @Ctx() { userId }: Context) {
    if (bio.length > 160) throw new Error('Bio must be 160 characters or less')
    await this.userRepository.update(userId, { bio })
    return true
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(() => Boolean)
  async followUser(
    @Arg('followedId', () => ID) followedId: string,
    @Ctx() { userId }: Context
  ) {
    if (followedId === userId) {
      throw new Error('Cannot follow yourself')
    }

    await this.userRepository
      .createQueryBuilder()
      .relation(User, 'following')
      .of(userId)
      .add(followedId)

    return true
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(() => Boolean)
  async unfollowUser(
    @Arg('followedId', () => ID) followedId: string,
    @Ctx() { userId }: Context
  ) {
    if (followedId === userId) {
      throw new Error('Cannot unfollow yourself')
    }

    await this.userRepository
      .createQueryBuilder()
      .relation(User, 'following')
      .of(userId)
      .remove(followedId)

    return true
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(() => Boolean)
  async blockUser(
    @Arg('blockedId', () => ID) blockedId: string,
    @Ctx() { userId }: Context
  ) {
    if (blockedId === userId) {
      throw new Error('Cannot block yourself')
    }

    await this.userRepository
      .createQueryBuilder('user')
      .relation(User, 'blockedUsers')
      .of(userId)
      .add(blockedId)
    return true
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(() => Boolean)
  async unblockUser(
    @Arg('blockedId', () => ID) blockedId: string,
    @Ctx() { userId }: Context
  ) {
    if (blockedId === userId) {
      throw new Error('Cannot unblock yourself')
    }

    await this.userRepository
      .createQueryBuilder('user')
      .relation(User, 'blockedUsers')
      .of(userId)
      .remove(blockedId)
    return true
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(() => Boolean)
  async banUser(
    @Arg('bannedId', () => ID) bannedId: string,
    @Arg('banReason') banReason: string,
    @Ctx() { userId }: Context
  ) {
    const user = await this.userRepository.findOne(userId)
    if (!user.admin) throw new Error('Must be admin to ban users')

    await this.userRepository.update(bannedId, { banned: true, banReason })

    return true
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(() => Boolean)
  async unbanUser(
    @Arg('bannedId', () => ID) bannedId: string,
    @Ctx() { userId }: Context
  ) {
    const user = await this.userRepository.findOne(userId)
    if (!user.admin) throw new Error('Must be admin to unban users')

    await this.userRepository.update(bannedId, {
      banned: false,
      banReason: null
    })

    return true
  }

  @FieldResolver(() => Boolean)
  async isFollowing(@Root() user: User, @Ctx() { userId }: Context) {
    if (!userId) return false

    user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId: userId })
      .leftJoinAndSelect(
        'user.following',
        'targetUser',
        'targetUser.id = :targetId',
        {
          targetId: user.id
        }
      )
      .getOne()

    if (!user) return false

    return Boolean((await user.following).length)
  }

  @FieldResolver(() => Boolean)
  async isFollowed(@Root() user: User, @Ctx() { userId }: Context) {
    if (!userId) return false

    user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId: user.id })
      .leftJoinAndSelect(
        'user.following',
        'targetUser',
        'targetUser.id = :targetId',
        {
          targetId: userId
        }
      )
      .getOne()

    if (!user) return false

    return Boolean((await user.following).length)
  }

  @FieldResolver(() => Boolean)
  async isBlocked(@Root() user: User, @Ctx() { userId }: Context) {
    if (!userId) return false

    user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId: user.id })
      .leftJoinAndSelect(
        'user.blockedUsers',
        'targetUser',
        'targetUser.id = :targetId',
        {
          targetId: userId
        }
      )
      .getOne()

    if (!user) return false

    return Boolean((await user.blockedUsers).length)
  }

  @FieldResolver(() => Boolean)
  async isBlocking(@Root() user: User, @Ctx() { userId }: Context) {
    if (!userId) return false

    user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId: userId })
      .leftJoinAndSelect(
        'user.blockedUsers',
        'targetUser',
        'targetUser.id = :targetId',
        {
          targetId: user.id
        }
      )
      .getOne()

    if (!user) return false

    return Boolean((await user.blockedUsers).length)
  }

  @FieldResolver(() => Boolean)
  async isCurrentUser(@Root() user: User, @Ctx() { userId }: Context) {
    return user.id === userId
  }
}
