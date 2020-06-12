import { Field, ID, ObjectType } from 'type-graphql'
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Post } from './Post'
import { Lazy } from '../lazy'
import { Comment } from './Comment'
import { User } from './User'

@ObjectType()
@Entity()
export class ReplyNotification {
  @Field()
  @PrimaryGeneratedColumn('uuid')
  readonly id: string

  @Field(type => User, { nullable: true })
  @ManyToOne(type => User)
  toUser: Lazy<User>

  @Field(type => ID, { nullable: true })
  @Column({ nullable: true })
  toUserId: string

  @Field(type => User, { nullable: true })
  @ManyToOne(type => User)
  fromUser: Lazy<User>

  @Field(type => ID, { nullable: true })
  @Column({ nullable: true })
  fromUserId: string

  @Field(type => Post, { nullable: true })
  @ManyToOne(type => Post)
  post: Lazy<Post>

  @Field(type => ID, { nullable: true })
  @Column({ nullable: true })
  postId: string

  @Field(type => Comment, { nullable: true })
  @ManyToOne(type => Comment)
  comment: Lazy<Comment>

  @Field(type => ID, { nullable: true })
  @Column({ nullable: true })
  commentId: string

  @Field()
  @Column({ default: false })
  read: boolean

  @Field()
  @Column()
  createdAt: Date

  @Field(type => ID, { nullable: true })
  @Column({ nullable: true })
  parentCommentId: string
}
