import { ArgsType, Field, ID } from 'type-graphql'
import { PostType } from '../entities/Post'

@ArgsType()
export class SubmitCommentArgs {
  @Field()
  textContent: string

  @Field(type => ID)
  postId: string

  @Field(type => ID, { nullable: true })
  parentCommentId?: string
}
