import { ArgsType, Field, ID } from 'type-graphql'
import { Length } from 'class-validator'

@ArgsType()
export class SubmitCommentArgs {
  @Field()
  @Length(1, 10000)
  textContent: string

  @Field(() => ID)
  postId: string

  @Field(() => ID, { nullable: true })
  parentCommentId?: string
}
