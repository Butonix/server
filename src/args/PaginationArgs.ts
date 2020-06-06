import { ArgsType, Field, Int } from 'type-graphql'
import { Max, Min } from 'class-validator'

@ArgsType()
export class PaginationArgs {
  @Field(type => Int, { defaultValue: 0 })
  @Min(0)
  page = 0

  @Field(type => Int, { defaultValue: 20 })
  @Min(1)
  @Max(50)
  pageSize = 20
}
