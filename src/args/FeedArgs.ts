import { ArgsType, Field } from 'type-graphql'
import { PaginationArgs } from './PaginationArgs'

export enum Sort {
  NEW = 'new',
  TOP = 'top',
  HOT = 'hot',
  COMMENTS = 'comments'
}

export enum Time {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
  ALL = 'all'
}

export enum Filter {
  ALL = 'all',
  MYTOPICS = 'mytopics'
}

export enum Type {
  TEXT = 'text',
  LINK = 'link',
  IMAGE = 'image'
}

@ArgsType()
export class FeedArgs extends PaginationArgs {
  @Field(() => Sort, { defaultValue: Sort.HOT })
  sort: Sort = Sort.HOT

  @Field(() => Time, { defaultValue: Time.ALL })
  time: Time = Time.ALL

  @Field(() => Filter, { defaultValue: Filter.ALL })
  filter: Filter = Filter.ALL

  @Field(() => [Type], { defaultValue: [] })
  types: Type[]

  @Field({ nullable: true })
  planetName?: string

  @Field({ nullable: true })
  username?: string
}
