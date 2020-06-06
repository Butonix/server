import { Field, ID, ObjectType } from 'type-graphql'
import { Column, Entity, ManyToMany, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm'
import { Comment } from './Comment'
import { Lazy } from '../lazy'
import { User } from './User'
import { PostEndorsement } from './PostEndorsement'
import { Topic } from './Topic'
import { PostView } from './PostView'

export enum PostType {
  TEXT = 'TEXT',
  LINK = 'LINK',
}

@ObjectType()
@Entity()
export class Post {
  @Field(type => ID)
  @PrimaryColumn('varchar', { length: 20 })
  id: string

  @Field()
  @Column()
  title: string

  @Field({ nullable: true })
  @Column({ nullable: true })
  textContent?: string

  @Field({ nullable: true })
  @Column({ nullable: true })
  link?: string

  @Field(type => User)
  @ManyToOne(
    type => User,
    user => user.posts,
  )
  author: Lazy<User>

  @Field(type => ID)
  @Column({ nullable: true })
  authorId: string

  @Field(type => PostType)
  @Column({
    type: 'enum',
    enum: PostType,
  })
  type: PostType

  @Field()
  @Column()
  createdAt: Date

  @OneToMany(
    type => Comment,
    comment => comment.post,
  )
  comments: Lazy<Comment[]>

  @Field()
  commentCount: number

  @Field(type => [Topic])
  @ManyToMany(
    type => Topic,
    topic => topic.posts,
  )
  topics: Lazy<Topic[]>

  @OneToMany(
    type => PostEndorsement,
    endorsement => endorsement.post,
  )
  endorsements: Lazy<PostEndorsement[]>

  @Field()
  @Column({ default: 0 })
  endorsementCount: number

  personalEndorsementCount: number

  @OneToMany(
    type => PostView,
    postView => postView.post,
  )
  postViews: Lazy<PostView[]>

  @Field()
  newCommentCount: number

  @Field()
  isEndorsed: boolean

  @Field({ nullable: true })
  @Column({ nullable: true })
  thumbnailUrl?: string

  @Field({ nullable: true })
  @Column({ nullable: true })
  domain?: string

  @Field()
  authorIsCurrentUser: boolean

  @Column({ default: false })
  deleted: boolean

  @Field({ nullable: true })
  postView: PostView
}
