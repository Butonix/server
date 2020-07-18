import { ArgsType, Field } from 'type-graphql'
import { Type } from './FeedArgs'
import { UserCommentsArgs } from './UserCommentsArgs'

@ArgsType()
export class UserPostsArgs extends UserCommentsArgs {
  @Field(type => [Type], { defaultValue: [] })
  types: Type[]
}
