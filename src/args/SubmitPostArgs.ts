import { ArgsType, Field } from 'type-graphql'
import { PostType } from '../entities/Post'

@ArgsType()
export class SubmitPostArgs {
  @Field()
  title: string

  @Field(type => PostType)
  type: PostType

  @Field({ nullable: true })
  link?: string

  @Field({ nullable: true })
  textContent?: string

  @Field(type => [String])
  topics: string[]
}
