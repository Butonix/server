import { Field, ID, ObjectType } from 'type-graphql'
import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { Comment } from './Comment'
import { Lazy } from '../lazy'
import { User } from './User'
import { Post } from './Post'

@ObjectType()
@Entity()
export class PostView {
  @ManyToOne(
    type => User,
    user => user.postViews,
  )
  user: Lazy<User>

  @Field(type => ID)
  @PrimaryColumn()
  userId: string

  @ManyToOne(
    type => Post,
    post => post.postViews,
  )
  post: Lazy<Post>

  @Field(type => ID)
  @PrimaryColumn()
  postId: string

  @Field()
  @Column()
  lastCommentCount: number

  @Field()
  @Column()
  createdAt: Date
}
