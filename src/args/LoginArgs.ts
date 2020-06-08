import { ArgsType, Field } from 'type-graphql'
import { IsAlphanumeric, Length } from 'class-validator'

@ArgsType()
export class LoginArgs {
  @Field()
  @Length(3, 20)
  @IsAlphanumeric()
  username: string

  @Field()
  @Length(6)
  password: string
}
