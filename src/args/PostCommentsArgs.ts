import { ArgsType, Field, ID } from 'type-graphql'
import { Sort, Time } from './FeedArgs'

@ArgsType()
export class PostCommentsArgs {
  @Field(type => ID)
  postId: string

  @Field(type => Sort, { defaultValue: Sort.TOP })
  sort: Sort = Sort.TOP
}
