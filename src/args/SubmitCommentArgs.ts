import { ArgsType, Field, ID } from 'type-graphql'
import { Length } from 'class-validator'

@ArgsType()
export class SubmitCommentArgs {
  @Field()
  @Length(1, 10000)
  textContent: string

  @Field((type) => ID)
  postId: string

  @Field((type) => ID, { nullable: true })
  parentCommentId?: string
}
