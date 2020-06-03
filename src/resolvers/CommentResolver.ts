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

@Resolver(of => Comment)
export class CommentResolver extends RepositoryInjector {
  @UseMiddleware(RequiresAuth)
  @Mutation(returns => Comment)
  async submitComment(
    @Args() { textContent, postId, parentCommentId }: SubmitCommentArgs,
    @Ctx() { userId }: Context,
  ) {
    if (!textContent) throw new Error('textContent cannot be empty')

    return this.commentRepository.save({
      id: shortid.generate(),
      textContent,
      parentCommentId,
      postId,
      authorId: userId,
      createdAt: new Date(),
      isEndorsed: false,
    } as Comment)
  }

  @Query(returns => [Comment])
  async postComments(@Arg('postId', type => ID) postId: string, @Ctx() { userId }: Context) {
    console.log('---------------------------postComments---------------------------')

    const post = await this.postRepository.findOne({ id: postId })
    if (!post) throw new Error('Invalid post ID')

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
    }

    const comments = await qb.addOrderBy('comment.createdAt', 'DESC').getMany()

    comments.forEach(comment => (comment.isEndorsed = Boolean(comment.personalEndorsementCount)))

    return comments
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
    return userLoader.load(comment.authorId)
  }

  @FieldResolver()
  async post(@Root() comment: Comment, @Ctx() { postLoader }: Context) {
    return postLoader.load(comment.postId)
  }
}
