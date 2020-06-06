import { ArgsType, Field } from 'type-graphql'
import { Length } from 'class-validator'

@ArgsType()
export class LoginArgs {
  @Field()
  @Length(3, 20)
  username: string

  @Field()
  @Length(6)
  password: string
}
