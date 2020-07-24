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
export class PostEndorsement {
  @ManyToOne(
    () => User,
    (user) => user.posts
  )
  user: Lazy<User>

  @Field(() => ID)
  @PrimaryColumn()
  userId: string

  @ManyToOne(
    () => Post,
    (post) => post.endorsements
  )
  post: Lazy<Post>

  @Field(() => ID)
  @PrimaryColumn()
  postId: string

  @Field()
  @Column()
  createdAt: Date

  @Field()
  @Column({ default: true })
  active: boolean
}
