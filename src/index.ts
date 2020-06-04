import 'reflect-metadata'
import * as path from 'path'
import { buildSchema, registerEnumType } from 'type-graphql'
import { User } from './entities/User'
import * as TypeORM from 'typeorm'
import { Container } from 'typedi'
import { Comment } from './entities/Comment'
import { getUser, refreshToken } from './auth'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { ApolloServer } from 'apollo-server-express'
import { Context } from './Context'
import { CommentLoader, PostLoader, UserLoader } from './loaders'
import { Post, PostType } from './entities/Post'
import { AuthResolver } from './resolvers/AuthResolver'
import { PostResolver } from './resolvers/PostResolver'
import { UserResolver } from './resolvers/UserResolver'
import { PostEndorsement } from './entities/PostEndorsement'
import { CommentEndorsement } from './entities/CommentEndorsement'
import { Topic } from './entities/Topic'
import { TopicResolver } from './resolvers/TopicResolver'
import { CommentResolver } from './resolvers/CommentResolver'
import { PostView } from './entities/PostView'
import { Sort, Time } from './args/FeedArgs'

// register 3rd party IOC container
TypeORM.useContainer(Container)

async function bootstrap() {
  const entities = [User, Comment, Post, PostEndorsement, CommentEndorsement, Topic, PostView]
  const resolvers = [PostResolver, UserResolver, AuthResolver, TopicResolver, CommentResolver]

  try {
    if (process.env.NODE_ENV === 'production') {
      await TypeORM.createConnection({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        entities,
        synchronize: true,
        logging: false,
        dropSchema: false, // CLEARS DATABASE ON START
        cache: true,
      })
    } else {
      // DEVELOPMENT
      await TypeORM.createConnection({
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'password',
        database: 'postgres',
        entities,
        synchronize: true,
        logging: true,
        dropSchema: false, // CLEARS DATABASE ON START
        cache: true,
      })
    }

    registerEnumType(PostType, {
      name: 'PostType',
    })

    registerEnumType(Sort, {
      name: 'Sort',
    })

    registerEnumType(Time, {
      name: 'Time',
    })

    // build TypeGraphQL executable schema
    const schema = await buildSchema({
      resolvers,
      emitSchemaFile:
        process.env.NODE_ENV === 'production'
          ? undefined
          : path.resolve(__dirname, 'schema.graphql'),
      container: Container,
      validate: false,
    })

    const app = express()

    app.use(
      cors({
        origin:
          process.env.NODE_ENV === 'production' ? 'https://getcomet.net' : 'http://localhost:8080',
        credentials: true,
      }),
    )

    app.use(cookieParser())

    app.post('/refresh_token', refreshToken)

    const server = new ApolloServer({
      schema,
      playground: process.env.NODE_ENV !== 'production',
      tracing: true,
      context: ({ req, res }) => {
        return {
          req,
          res,
          userId: getUser(req),
          userLoader: UserLoader,
          postLoader: PostLoader,
          commentLoader: CommentLoader,
        } as Context
      },
    })

    server.applyMiddleware({
      app,
      cors: {
        origin:
          process.env.NODE_ENV === 'production' ? 'https://getcomet.net' : 'http://localhost:8080',
        credentials: true,
      },
    })

    app.listen({ port: process.env.PORT || 4000 }, () => {
      console.log(`Server ready at http://localhost:4000${server.graphqlPath}`)
    })
  } catch (e) {
    console.error(e)
  }
}

bootstrap()
