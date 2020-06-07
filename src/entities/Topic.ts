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
import { PostEndorsement } from './PostEndorsement'
import { Post } from './Post'

@ObjectType()
@Entity()
export class Topic {
  @Field()
  @PrimaryColumn()
  name: string

  @Column('int', { select: false, default: 0 })
  total: number

  @ManyToMany(
    type => Post,
    post => post.topics,
  )
  @JoinTable()
  posts: Lazy<Post[]>

  @ManyToMany(
    type => User,
    user => user.followedTopics,
  )
  @JoinTable()
  followers: Lazy<User[]>

  @Field()
  followerCount: number

  @Field()
  isHidden: boolean

  @Field()
  postCount: number

  @Field()
  capitalizedName: string

  @Field()
  isFollowing: boolean
}
