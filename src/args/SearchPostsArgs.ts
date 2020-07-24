import { ArgsType, Field } from 'type-graphql'
import { PaginationArgs } from './PaginationArgs'
import { Sort, Time } from './FeedArgs'

@ArgsType()
export class SearchPostsArgs extends PaginationArgs {
  @Field()
  search: string

  @Field(() => Sort, { defaultValue: Sort.NEW })
  sort: Sort

  @Field(() => Time, { defaultValue: Time.ALL })
  time: Time
}
