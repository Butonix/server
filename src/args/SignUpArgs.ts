import { ArgsType, Field } from 'type-graphql'
import { IsEmail } from 'class-validator'
import { LoginArgs } from './LoginArgs'

@ArgsType()
export class SignUpArgs extends LoginArgs {
  @Field({ nullable: true })
  @IsEmail()
  email?: string
}
