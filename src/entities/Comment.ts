import { Field, ID, ObjectType } from 'type-graphql'
import { User } from './User'
import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  Tree,
  TreeChildren,
  TreeParent
} from 'typeorm'
import { Lazy } from '../lazy'
import { Post } from './Post'
import { CommentEndorsement } from './CommentEndorsement'

@ObjectType()
@Entity()
@Tree('materialized-path')
export class Comment {
  @Field((type) => ID)
  @PrimaryColumn('varchar', { length: 20 })
  id: string

  @Field((type) => User, { nullable: true })
  @ManyToOne(
    (type) => User,
    (user) => user.comments
  )
  author: Lazy<User>

  @Field((type) => ID, { nullable: true })
  @Column({ nullable: true })
  authorId: string

  @Field((type) => Post, { nullable: true })
  @ManyToOne(
    (type) => Post,
    (post) => post.comments
  )
  post: Lazy<Post>

  @Field((type) => ID, { nullable: true })
  @Column({ nullable: true })
  postId: string

  @Field((type) => ID, { nullable: true })
  @Column({ nullable: true })
  rootCommentId: string

  @Field()
  @Column('text')
  textContent: string

  @Field()
  @Column()
  createdAt: Date

  @Field({ nullable: true })
  @Column({ nullable: true })
  editedAt?: Date

  @Field((type) => Comment, { nullable: true })
  @TreeParent()
  parentComment: Lazy<Comment>

  @Field((type) => ID, { nullable: true })
  @Column({ nullable: true })
  parentCommentId: string

  @TreeChildren()
  childComments: Lazy<Comment[]>

  @OneToMany(
    (type) => CommentEndorsement,
    (endorsement) => endorsement.comment
  )
  endorsements: Lazy<CommentEndorsement[]>

  @Field()
  @Column({ default: 0 })
  endorsementCount: number

  personalEndorsementCount: number

  @Field()
  isEndorsed: boolean

  @Column({ default: false })
  deleted: boolean
}
