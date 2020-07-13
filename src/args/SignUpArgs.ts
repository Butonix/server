import { ArgsType, Field } from 'type-graphql'
import { IsEmail, IsOptional } from 'class-validator'
import { LoginArgs } from './LoginArgs'

@ArgsType()
export class SignUpArgs extends LoginArgs {
  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string
}
