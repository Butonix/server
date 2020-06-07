import { ArgsType, Field } from 'type-graphql'
import { PostType } from '../entities/Post'
import { Length, ArrayMaxSize, ArrayMinSize, ArrayUnique, Matches } from 'class-validator'

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
  @ArrayMaxSize(10)
  @ArrayMinSize(1)
  @ArrayUnique()
  @Matches(/^[a-z0-9 ]+$/i, { each: true })
  @Length(1, 50, { each: true })
  topics: string[]
}
