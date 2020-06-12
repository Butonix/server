import 'reflect-metadata'
import * as path from 'path'
import { buildSchema, registerEnumType } from 'type-graphql'
import { User } from './entities/User'
import * as TypeORM from 'typeorm'
import { Container } from 'typedi'
import { Comment } from './entities/Comment'
import { getUser } from './auth'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { ApolloServer } from 'apollo-server-express'
import { Context } from './Context'
import { CommentLoader, PostLoader, PostViewLoader, UserLoader } from './loaders'
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
import { Filter, Sort, Time, Type } from './args/FeedArgs'
import { FiltersResolver } from './resolvers/FiltersResolver'
import aws from 'aws-sdk'
import multer from 'multer'
import { S3Storage } from './S3Storage'
import { ReplyNotification } from './entities/ReplyNotification'
import { NotificationResolver } from './resolvers/NotificationResolver'

// register 3rd party IOC container
TypeORM.useContainer(Container)

aws.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
})

async function bootstrap() {
  const entities = [
    User,
    Comment,
    Post,
    PostEndorsement,
    CommentEndorsement,
    Topic,
    PostView,
    ReplyNotification,
  ]
  const resolvers = [
    PostResolver,
    UserResolver,
    AuthResolver,
    TopicResolver,
    CommentResolver,
    FiltersResolver,
    NotificationResolver,
  ]

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

    registerEnumType(Filter, {
      name: 'Filter',
    })

    registerEnumType(Type, {
      name: 'Type',
    })

    // build TypeGraphQL executable schema
    const schema = await buildSchema({
      resolvers,
      emitSchemaFile:
        process.env.NODE_ENV === 'production'
          ? undefined
          : path.resolve(__dirname, 'schema.graphql'),
      container: Container,
      validate: true,
    })

    const app = express()

    const origin =
      process.env.NODE_ENV === 'production' ? process.env.ORIGIN_URL : 'http://localhost:3000'

    app.use(
      cors({
        origin,
        credentials: true,
      }),
    )

    app.use(cookieParser())

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
          postViewLoader: PostViewLoader,
        } as Context
      },
    })

    server.applyMiddleware({
      app,
      cors: {
        origin,
        credentials: true,
      },
    })

    const upload = multer({
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
          cb(null, true)
        } else {
          cb(new Error('Image must be JPEG or PNG'))
        }
      },
      limits: {
        fileSize: 4 * 1024 * 1024,
      },
      storage: new S3Storage(),
    })

    const imageUpload = upload.single('image')

    app.post(
      '/upload',
      (req: any, res: any, next: any) => {
        imageUpload(req, res, (err: any): any => {
          if (err) next(err)
          else next()
        })
      },
      (req: any, res: any, next: any) => {
        // @ts-ignore
        return res.send({ link: req.file.location })
      },
      (err: any, req: any, res: any, next: any) => {
        res.send({ error: err.message })
      },
    )

    app.listen({ port: process.env.PORT || 4000 }, () => {
      console.log(`Server ready at http://localhost:4000${server.graphqlPath}`)
    })
  } catch (e) {
    console.error(e)
  }
}

bootstrap()
