import 'newrelic'

import 'reflect-metadata'
import * as path from 'path'
import { buildSchema, registerEnumType } from 'type-graphql'
import * as TypeORM from 'typeorm'
import { Container } from 'typedi'
import { getUser } from './auth'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { ApolloServer } from 'apollo-server-express'
import { Context } from './Context'
import {
  CommentLoader,
  PostLoader,
  PostViewLoader,
  UserLoader
} from './loaders'
import { PostType } from './entities/Post'
import { Filter, Sort, Time, Type } from './args/FeedArgs'
import aws from 'aws-sdk'
import multer from 'multer'
import { ImageStorage } from './ImageStorage'
// @ts-ignore
import { avataaarEndpoint } from './avataaars/avataaarEndpoint'
import { ProfilePicStorage } from './ProfilePicStorage'
import { CommentSort } from './args/UserCommentsArgs'
import { entities, resolvers } from './EntitiesAndResolvers'
import { getRepository } from 'typeorm'
import { Galaxy } from './entities/Galaxy'
import { galaxiesList } from './galaxiesList'

// register 3rd party IOC container
TypeORM.useContainer(Container)

aws.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY
})

async function bootstrap() {
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
        dropSchema: false, // CLEARS DATABASE ON START
        cache: true
      })
    } else if (process.env.NODE_ENV === 'production' && !process.env.STAGING) {
      // PROD
      await TypeORM.createConnection({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        entities,
        synchronize: true,
        logging: false,
        cache: true
      })
    } else if (
      process.env.NODE_ENV === 'production' &&
      process.env.STAGING === 'true'
    ) {
      // STAGING
      await TypeORM.createConnection({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        entities,
        synchronize: true,
        logging: false,
        dropSchema: true, // CLEARS DATABASE ON START
        cache: true
      })
    } else return

    getRepository(Galaxy).save(galaxiesList)

    registerEnumType(PostType, {
      name: 'PostType'
    })

    registerEnumType(Sort, {
      name: 'Sort'
    })

    registerEnumType(Time, {
      name: 'Time'
    })

    registerEnumType(Filter, {
      name: 'Filter'
    })

    registerEnumType(Type, {
      name: 'Type'
    })

    registerEnumType(CommentSort, {
      name: 'CommentSort'
    })

    // build TypeGraphQL executable schema
    const schema = await buildSchema({
      resolvers,
      emitSchemaFile:
        process.env.NODE_ENV === 'production'
          ? undefined
          : path.resolve(__dirname, 'schema.graphql'),
      container: Container,
      validate: true
    })

    const app = express()

    const origin =
      process.env.NODE_ENV === 'production' ? process.env.ORIGIN_URL : true

    app.use(
      cors({
        origin,
        credentials: true
      })
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
          postViewLoader: PostViewLoader
        } as Context
      }
    })

    server.applyMiddleware({
      app,
      cors: {
        origin,
        credentials: true
      }
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
        fileSize: 4 * 1024 * 1024
      },
      storage: new ImageStorage()
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
      (req: any, res: any) => {
        // @ts-ignore
        return res.send({ link: req.file.location })
      },
      (err: any, req: any, res: any) => {
        res.send({ error: err.message })
      }
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
        fileSize: 4 * 1024 * 1024
      },
      storage: new ProfilePicStorage()
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
      (req: any, res: any) => {
        // @ts-ignore
        return res.send({ link: req.file.location })
      },
      (err: any, req: any, res: any) => {
        res.send({ error: err.message })
      }
    )

    app.get('/avataaar', avataaarEndpoint)

    app.listen({ port: process.env.PORT || 4000 }, () => {
      console.log(`Server ready at http://localhost:4000${server.graphqlPath}`)
    })
  } catch (e) {
    console.error(e)
  }
}

bootstrap()
