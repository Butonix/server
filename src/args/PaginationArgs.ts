import { ArgsType, Field, Int } from 'type-graphql'

@ArgsType()
export class PaginationArgs {
  @Field(type => Int, { defaultValue: 0 })
  page = 0

  @Field(type => Int, { defaultValue: 10 })
  pageSize = 10
}
