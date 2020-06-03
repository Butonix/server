import { MiddlewareFn } from 'type-graphql'
import { Context } from './Context'

export const RequiresAuth: MiddlewareFn<Context> = ({ context }, next) => {
  if (!context.userId) {
    throw new Error('Not Authenticated')
  }
  return next()
}
