import { Field, ID, ObjectType } from 'type-graphql'
import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn
} from 'typeorm'
import { Comment } from './Comment'
import { Lazy } from '../lazy'
import { User } from './User'
import { Post } from './Post'

@ObjectType()
@Entity()
export class CommentEndorsement {
  @ManyToOne(
    () => User,
    (user) => user.posts
  )
  user: Lazy<User>

  @Field(() => ID)
  @PrimaryColumn()
  userId: string

  @ManyToOne(
    () => Comment,
    (comment) => comment.endorsements
  )
  comment: Lazy<Comment>

  @Field(() => ID)
  @PrimaryColumn()
  commentId: string

  @Field()
  @Column()
  createdAt: Date

  @Field()
  @Column({ default: true })
  active: boolean
}
