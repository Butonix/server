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
import { RequiresAuth } from '../RequiresAuth'
import { Context } from '../Context'
import { RepositoryInjector } from '../RepositoryInjector'
import { Comment } from '../entities/Comment'
import { SubmitCommentArgs } from '../args/SubmitCommentArgs'
import shortid from 'shortid'
import { PostView } from '../entities/PostView'
import { PostCommentsArgs } from '../args/PostCommentsArgs'
import { Sort, Time } from '../args/FeedArgs'
import { User } from '../entities/User'
import { differenceInSeconds } from 'date-fns'
import { ReplyNotification } from '../entities/ReplyNotification'

@Resolver(of => Comment)
export class CommentResolver extends RepositoryInjector {
  @UseMiddleware(RequiresAuth)
  @Mutation(returns => Comment)
  async submitComment(
    @Args() { textContent, postId, parentCommentId }: SubmitCommentArgs,
    @Ctx() { userId }: Context,
  ) {
    if (!textContent) throw new Error('textContent cannot be empty')

    const user = await this.userRepository.findOne(userId)

    if (user.lastCommentedAt && !user.admin) {
      if (differenceInSeconds(new Date(), user.lastCommentedAt) < 15) {
        throw new Error('Please wait 15 seconds between comments')
      }
    }

    this.userRepository.update(userId, { lastCommentedAt: new Date() })

    const commentId = shortid.generate()

    const savedComment = await this.commentRepository.save({
      id: commentId,
      textContent,
      parentCommentId,
      postId,
      authorId: userId,
      createdAt: new Date(),
      isEndorsed: false,
    } as Comment)

    if (parentCommentId) {
      const parentComment = await this.commentRepository.findOne(parentCommentId)
      if (parentComment.authorId !== userId) {
        this.replyNotifRepository.save({
          commentId,
          fromUserId: userId,
          toUserId: parentComment.authorId,
          postId,
          createdAt: new Date(),
          parentCommentId,
        } as ReplyNotification)
      }
    } else {
      const post = await this.postRepository.findOne(postId)
      if (post.authorId !== userId) {
        this.replyNotifRepository.save({
          commentId,
          fromUserId: userId,
          toUserId: post.authorId,
          postId,
          createdAt: new Date(),
        } as ReplyNotification)
      }
    }

    return savedComment
  }

  @Query(returns => [Comment])
  async postComments(@Args() { postId, sort }: PostCommentsArgs, @Ctx() { userId }: Context) {
    const post = await this.postRepository.findOne({ id: postId })

    if (!post) return []

    const qb = await this.commentRepository
      .createQueryBuilder('comment')
      .where('comment.postId = :postId', { postId: post.id })

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

      const blockedUsers = (
        await this.userRepository
          .createQueryBuilder()
          .relation(User, 'blockedUsers')
          .of(userId)
          .loadMany()
      ).map(user => user.id)

      qb.andWhere('NOT (comment.authorId = ANY(:blockedUsers))', { blockedUsers })
    }

    if (sort === Sort.TOP) {
      qb.addOrderBy('comment.endorsementCount', 'DESC')
    }

    qb.addOrderBy('comment.createdAt', 'DESC')

    const comments = await qb.getMany()

    comments.forEach(comment => {
      comment.isEndorsed = Boolean(comment.personalEndorsementCount)
      if (comment.deleted) {
        comment.textContent = JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ text: '[deleted]', type: 'text' }] }],
        })
        comment.authorId = null
        comment.author = null
      }
    })

    return comments
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(returns => Boolean)
  async deleteComment(@Arg('commentId', type => ID) commentId: string, @Ctx() { userId }: Context) {
    const comment = await this.commentRepository.findOne(commentId)
    const user = await this.userRepository.findOne(userId)
    if (comment.authorId !== userId && !user.admin)
      throw new Error('Attempt to delete post by someone other than author')

    await this.commentRepository
      .createQueryBuilder()
      .update()
      .set({ deleted: true })
      .where('id = :commentId', { commentId })
      .execute()

    return true
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(returns => Boolean)
  async editComment(
    @Arg('commentId', type => ID) commentId: string,
    @Arg('newTextContent') newTextContent: string,
    @Ctx() { userId }: Context,
  ) {
    if (newTextContent.length === 0) throw new Error('newTextContent cannot be empty')

    const comment = await this.commentRepository.findOne(commentId)
    const user = await this.userRepository.findOne(userId)
    if (comment.authorId !== userId && !user.admin)
      throw new Error('Attempt to edit post by someone other than author')

    const editHistory = comment.editHistory
    editHistory.unshift(comment.textContent)

    await this.commentRepository
      .createQueryBuilder()
      .update()
      .set({ editedAt: new Date(), textContent: newTextContent, editHistory })
      .where('id = :commentId', { commentId })
      .execute()

    return true
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(returns => Boolean)
  async toggleCommentEndorsement(
    @Arg('commentId', type => ID) commentId: string,
    @Ctx() { userId }: Context,
  ) {
    const comment = await this.commentRepository
      .createQueryBuilder('comment')
      .whereInIds(commentId)
      .leftJoinAndSelect('comment.author', 'author')
      .getOne()
    if (!comment) throw new Error('Invalid commentId')

    if (userId === comment.authorId) throw new Error('Cannot endorse your own comment')

    let active: boolean

    const endorsement = await this.commentEndorsementRepository.findOne({ commentId, userId })
    if (endorsement) {
      await this.commentEndorsementRepository.update(
        { commentId, userId },
        { active: !endorsement.active },
      )
      active = !endorsement.active
    } else {
      await this.commentEndorsementRepository.save({
        commentId,
        userId,
        createdAt: new Date(),
        active: true,
      })
      active = true
    }

    this.commentRepository.update(
      { id: commentId },
      { endorsementCount: active ? comment.endorsementCount + 1 : comment.endorsementCount - 1 },
    )

    const author = await comment.author
    this.userRepository.update(
      { id: author.id },
      { endorsementCount: active ? author.endorsementCount + 1 : author.endorsementCount - 1 },
    )

    return active
  }

  @FieldResolver()
  async author(@Root() comment: Comment, @Ctx() { userLoader }: Context) {
    if (!comment.authorId) return null
    return userLoader.load(comment.authorId)
  }

  @FieldResolver()
  async post(@Root() comment: Comment, @Ctx() { postLoader }: Context) {
    return postLoader.load(comment.postId)
  }
}
