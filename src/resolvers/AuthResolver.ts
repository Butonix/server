import { Args, Ctx, Mutation, Resolver } from 'type-graphql'
import { LoginResponse } from '../responses/LoginResponse'
import { LoginArgs } from '../args/LoginArgs'
import { Context } from '../Context'
import { User } from '../entities/User'
import { Repository } from 'typeorm'
import { InjectRepository } from 'typeorm-typedi-extensions'
import { createAccessToken } from '../auth'
import * as argon2 from 'argon2'

@Resolver()
export class AuthResolver {
  @InjectRepository(User) readonly userRepository: Repository<User>

  @Mutation(returns => LoginResponse)
  async signUp(@Args() { username, password }: LoginArgs, @Ctx() { req, res }: Context) {
    console.log('---------------------------signUp---------------------------')

    const foundUser = await this.userRepository.findOne({ username })
    if (foundUser) throw new Error('Username taken')

    const passwordHash = await argon2.hash(password)

    const user = await this.userRepository.save({
      username,
      passwordHash,
      createdAt: new Date(),
      lastLogin: new Date(),
    } as User)

    return {
      accessToken: createAccessToken(user),
      user,
    } as LoginResponse
  }

  @Mutation(returns => LoginResponse)
  async login(@Args() { username, password }: LoginArgs, @Ctx() { req, res }: Context) {
    console.log('---------------------------login---------------------------')

    const user = await this.userRepository.findOne({ username })
    if (!user) throw new Error('Invalid Login')

    await this.userRepository
      .createQueryBuilder()
      .update()
      .set({ lastLogin: new Date() })
      .where('username = :username', { username })
      .execute()

    const match = await argon2.verify(user.passwordHash, password)

    if (!match) throw new Error('Invalid Login')

    return {
      accessToken: createAccessToken(user),
      user,
    } as LoginResponse
  }
}
