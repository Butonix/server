import { ArgsType, Field } from 'type-graphql'
import { PaginationArgs } from './PaginationArgs'

@ArgsType()
export class UserCommentsArgs extends PaginationArgs {
  @Field()
  username: string
}
