import { ArgsType, Field } from 'type-graphql'
import { PaginationArgs } from './PaginationArgs'
import { Sort, Time } from './FeedArgs'

@ArgsType()
export class SearchPostsArgs extends PaginationArgs {
  @Field()
  search: string

  @Field(type => Sort, { defaultValue: Sort.RELEVANCE })
  sort: Sort

  @Field(type => Time, { defaultValue: Time.ALL })
  time: Time
}
