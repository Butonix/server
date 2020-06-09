import { StorageEngine } from 'multer'
import { ManagedUpload } from 'aws-sdk/lib/s3/managed_upload'
import { getUser } from './auth'
import shortid from 'shortid'
import sharp from 'sharp'
import { s3 } from './s3'
import { Stream } from 'stream'
import { differenceInSeconds } from 'date-fns'
import { getRepository } from 'typeorm'
import { User } from './entities/User'

export class S3Storage implements StorageEngine {
  async _handleFile(
    req: Express.Request,
    file: any,
    callback: (error?: Error | null, info?: Partial<Express.Multer.File>) => void,
  ): Promise<void> {
    const userId = getUser(req)
    if (!userId) {
      callback(new Error('Not Authenticated'))
      return
    }

    const user = await getRepository(User).findOne(userId)

    if (user.lastPostedAt && !user.admin) {
      if (differenceInSeconds(new Date(), user.lastPostedAt) < 60 * 2) {
        callback(new Error('Please wait 2 minutes between posts'))
      }
    }

    /*const transformer = sharp()
      .resize(2000, 2000, { fit: 'inside' })
      .png()

    const outStream = new Stream.PassThrough()

    file.stream.pipe(transformer).pipe(outStream)*/

    const key = `${shortid.generate()}.png`

    const upload = s3.upload({
      Bucket: 'i.getcomet.net',
      Key: key,
      Body: file.stream,
      ContentType: file.mimetype,
      ACL: 'public-read',
    })

    upload.send((err, result) => {
      if (err) return callback(err)

      callback(null, {
        // @ts-ignore
        bucket: 'i.getcomet.net',
        // @ts-ignore
        key,
        // @ts-ignore
        location: result.Location.replace('s3.amazonaws.com/', ''),
      })
    })
  }

  _removeFile(
    req: Express.Request,
    file: Express.Multer.File,
    callback: (error?: Error | null) => void,
  ): void {
    const userId = getUser(req)
    if (!userId) {
      callback(new Error('Not Authenticated'))
      return
    }

    // @ts-ignore
    s3.deleteObject({ Bucket: file.bucket, Key: file.key }, callback)
  }
}
