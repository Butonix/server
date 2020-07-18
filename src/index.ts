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
import { ImageStorage } from './ImageStorage'
import { ReplyNotification } from './entities/ReplyNotification'
import { NotificationResolver } from './resolvers/NotificationResolver'
import { FakeDataGenerator } from './generateFakeData'
import { getRepository, getTreeRepository } from 'typeorm'
// @ts-ignore
import { avataaarEndpoint } from './avataaars/avataaarEndpoint'
import { ProfilePicStorage } from './ProfilePicStorage'
import { CommentSort } from './args/UserCommentsArgs'

// register 3rd party IOC container
TypeORM.useContainer(Container)

aws.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
})

let generateFakeData = false
if (process.env.STAGING === 'true') {
  // STAGING
  generateFakeData = true
} else if (process.env.NODE_ENV === 'production' && !process.env.STAGING) {
  // PROD
  generateFakeData = false
} else if (process.env.NODE_ENV !== 'production') {
  // DEV
  generateFakeData = false // edit this for dev
}

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
    if (process.env.NODE_ENV !== 'production') {
      // DEV
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
        dropSchema: generateFakeData, // CLEARS DATABASE ON START
        cache: true,
      })
    } else if (process.env.NODE_ENV === 'production' && !process.env.STAGING) {
      // PROD
      await TypeORM.createConnection({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        entities,
        synchronize: true,
        logging: false,
        cache: true,
      })
    } else if (process.env.NODE_ENV === 'production' && process.env.STAGING === 'true') {
      // STAGING
      await TypeORM.createConnection({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        entities,
        synchronize: true,
        logging: false,
        dropSchema: true, // CLEARS DATABASE ON START
        cache: true,
      })
    } else return

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

    registerEnumType(CommentSort, {
      name: 'CommentSort',
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

    const origin = process.env.NODE_ENV === 'production' ? process.env.ORIGIN_URL : true

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
      storage: new ImageStorage(),
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

    const uploadProfilePic = multer({
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
      storage: new ProfilePicStorage(),
    })

    const profilePicUpload = uploadProfilePic.single('image')

    app.post(
      '/uploadprofilepic',
      (req: any, res: any, next: any) => {
        profilePicUpload(req, res, (err: any): any => {
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

    app.get('/avataaar', avataaarEndpoint)

    app.listen({ port: process.env.PORT || 4000 }, () => {
      console.log(`Server ready at http://localhost:4000${server.graphqlPath}`)
    })

    if (
      (process.env.NODE_ENV !== 'production' || process.env.STAGING === 'true') &&
      generateFakeData
    ) {
      await new FakeDataGenerator().generateFakeData(
        1000,
        getRepository(User),
        getRepository(Post),
        getRepository(Topic),
        getTreeRepository(Comment),
      )
    }
  } catch (e) {
    console.error(e)
  }
}

bootstrap()
