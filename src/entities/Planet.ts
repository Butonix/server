import { Field, ID, ObjectType } from 'type-graphql'
import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryColumn,
  OneToMany,
  ManyToOne
} from 'typeorm'
import { Lazy } from '../lazy'
import { User } from './User'
import { Post } from './Post'
import { Galaxy } from './Galaxy'
import { Sort } from '../args/FeedArgs'
import { CommentSort } from '../args/UserCommentsArgs'

@ObjectType()
@Entity()
export class Planet {
  @Field(() => ID)
  @PrimaryColumn()
  name: string

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  fullName?: string

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  description?: string

  @Field()
  @Column()
  createdAt: Date

  @Field(() => User, { nullable: true })
  @ManyToOne(
    () => User,
    (user) => user.posts
  )
  creator: Lazy<User>

  @Field(() => ID)
  @Column({ nullable: true })
  creatorId: string

  @OneToMany(
    () => Post,
    (post) => post.planet
  )
  @JoinTable()
  posts: Lazy<Post[]>

  @ManyToMany(
    () => User,
    (user) => user.planets
  )
  @JoinTable()
  users: Lazy<User[]>

  @Field()
  userCount: number

  @Field(() => [User])
  @ManyToMany(
    () => User,
    (user) => user.moderatedPlanets
  )
  @JoinTable()
  moderators: Lazy<User[]>

  @Field(() => Galaxy)
  @ManyToOne(
    () => Galaxy,
    (galaxy) => galaxy.planets,
    { cascade: true }
  )
  galaxy: Lazy<Galaxy>

  @Field()
  @Column({ default: true })
  allowTextPosts: boolean

  @Field()
  @Column({ default: true })
  allowLinkPosts: boolean

  @Field()
  @Column({ default: true })
  allowImagePosts: boolean

  @Field(() => Sort)
  @Column({
    type: 'enum',
    enum: Sort,
    default: Sort.HOT
  })
  defaultSort: Sort

  @Field(() => CommentSort)
  @Column({
    type: 'enum',
    enum: CommentSort,
    default: CommentSort.TOP
  })
  defaultCommentSort: CommentSort

  @Field({ nullable: true })
  @Column({ nullable: true })
  avatarImageUrl?: string

  @Field({ nullable: true })
  @Column({ nullable: true })
  cardImageUrl?: string

  @Field({ nullable: true })
  @Column({ nullable: true })
  themeColor?: string

  @Field()
  blocking: boolean

  @Field()
  joined: boolean

  @Field()
  postCount: number

  @Column('int', { select: false, default: 0 })
  total: number
}
