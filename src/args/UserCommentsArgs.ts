import { ArgsType, Field } from 'type-graphql'
import { PaginationArgs } from './PaginationArgs'
import { Length } from 'class-validator'

@ArgsType()
export class UserCommentsArgs extends PaginationArgs {
  @Field()
  @Length(3, 20)
  username: string
}
