import { ArgsType, Field } from 'type-graphql'
import { PaginationArgs } from './PaginationArgs'

export enum Sort {
  NEW = 'NEW',
  TOP = 'TOP',
  HOT = 'HOT',
}

export enum Time {
  HOUR = 'HOUR',
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  YEAR = 'YEAR',
  ALL = 'ALL',
}

@ArgsType()
export class FeedArgs extends PaginationArgs {
  @Field(type => Sort, { defaultValue: Sort.HOT })
  sort: Sort

  @Field(type => Time, { defaultValue: Time.DAY })
  time: Time
}
