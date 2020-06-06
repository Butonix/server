import { ArgsType, Field } from 'type-graphql'
import { PostType } from '../entities/Post'
import { Length, ArrayMaxSize, ArrayMinSize } from 'class-validator'

@ArgsType()
export class SubmitPostArgs {
  @Field()
  @Length(1, 300)
  title: string

  @Field(type => PostType)
  type: PostType

  @Field({ nullable: true })
  @Length(1, 5000)
  link?: string

  @Field({ nullable: true })
  @Length(1, 40000)
  textContent?: string

  @Field(type => [String])
  @ArrayMaxSize(30)
  @ArrayMinSize(1)
  topics: string[]
}
