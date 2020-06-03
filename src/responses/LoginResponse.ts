import { Field, ObjectType } from 'type-graphql'
import { User } from '../entities/User'

@ObjectType()
export class LoginResponse {
  @Field(type => User)
  user: User

  @Field()
  accessToken: string
}
