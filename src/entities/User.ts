import { Field, ID, ObjectType } from 'type-graphql'
import { Column, Entity, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { Comment } from './Comment'
import { Lazy } from '../lazy'
import { Post } from './Post'
import { PostEndorsement } from './PostEndorsement'
import { CommentEndorsement } from './CommentEndorsement'
import { Topic } from './Topic'
import { PostView } from './PostView'

@ObjectType()
@Entity()
export class User {
  @Field(type => ID)
  @PrimaryGeneratedColumn('uuid')
  readonly id: string

  @Field()
  @Column()
  username: string

  @Field()
  @Column()
  createdAt: Date

  @Column()
  lastLogin: Date

  @Column()
  passwordHash: string

  @Column({ default: false })
  admin: boolean

  @Column({ default: false })
  banned: boolean

  @Column({ default: '' })
  banReason: string

  @OneToMany(
    type => Comment,
    comment => comment.author,
  )
  comments: Lazy<Comment[]>

  @OneToMany(
    type => Post,
    post => post.author,
  )
  posts: Lazy<Post[]>

  @Field(type => [Topic])
  @ManyToMany(
    type => Topic,
    topic => topic.followers,
  )
  followedTopics: Lazy<Topic[]>

  @ManyToMany(type => Topic)
  @JoinTable()
  hiddenTopics: Lazy<Topic[]>

  @ManyToMany(type => Post)
  @JoinTable()
  hiddenPosts: Lazy<Post[]>

  @ManyToMany(
    type => User,
    user => user.following,
  )
  @JoinTable()
  followers: Lazy<User[]>

  @ManyToMany(
    type => User,
    user => user.followers,
  )
  following: Lazy<User[]>

  @ManyToMany(
    type => User,
    user => user.blockedUsers,
  )
  @JoinTable()
  blockedBy: Lazy<User[]>

  @ManyToMany(
    type => User,
    user => user.blockedBy,
  )
  blockedUsers: Lazy<User[]>

  /**
   * Current user is following this user
   */
  @Field()
  isFollowing: boolean

  @Field()
  isCurrentUser: boolean

  @Field()
  followerCount: number

  @Field()
  commentCount: number

  @Field()
  postCount: number

  @OneToMany(
    type => PostEndorsement,
    endorsement => endorsement.user,
  )
  postEndorsements: Lazy<PostEndorsement[]>

  @OneToMany(
    type => CommentEndorsement,
    endorsement => endorsement.user,
  )
  commentEndorsements: Lazy<CommentEndorsement[]>

  @Field()
  @Column({ default: 0 })
  endorsementCount: number

  @Column({ nullable: true })
  lastPostedAt: Date

  @Column({ nullable: true })
  lastCommentedAt: Date

  @OneToMany(
    type => PostView,
    postView => postView.user,
  )
  postViews: Lazy<PostView[]>

  /**
   * Current user is blocked by this user
   */
  @Field()
  isBlocked: boolean

  /**
   * Current user is blocking this user
   */
  @Field()
  isBlocking: boolean
}
