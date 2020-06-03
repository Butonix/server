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
export class CommentEndorsement {
  @ManyToOne(
    type => User,
    user => user.posts,
  )
  user: Lazy<User>

  @Field(type => ID)
  @PrimaryColumn()
  userId: string

  @ManyToOne(
    type => Comment,
    comment => comment.endorsements,
  )
  comment: Lazy<Comment>

  @Field(type => ID)
  @PrimaryColumn()
  commentId: string

  @Field()
  @Column()
  createdAt: Date

  @Field()
  @Column({ default: true })
  active: boolean
}
