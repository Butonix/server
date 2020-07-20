import { StorageEngine } from 'multer'
import { getUser } from './auth'
import shortid from 'shortid'
import sharp from 'sharp'
import { s3 } from './s3'
import { Stream } from 'stream'
import { differenceInSeconds } from 'date-fns'
import { getRepository } from 'typeorm'
import { User } from './entities/User'

export class ProfilePicStorage implements StorageEngine {
  async _handleFile(
    req: Express.Request,
    file: any,
    callback: (
      error?: Error | null,
      info?: Partial<Express.Multer.File>
    ) => void
  ): Promise<void> {
    const userId = getUser(req)
    if (!userId) {
      callback(new Error('Not Authenticated'))
      return
    }

    const user = await getRepository(User).findOne(userId)

    if (!user) {
      callback(new Error('Invalid login'))
      return
    }

    if (user.lastUploadedImageAt && !user.admin) {
      if (differenceInSeconds(new Date(), user.lastUploadedImageAt) < 60 * 2) {
        callback(new Error('Please wait 2 minutes between image uploads'))
        return
      }
    }

    await getRepository(User).update(userId, {
      lastUploadedImageAt: new Date()
    })

    const transformer = sharp()
      .resize(370, 370, { fit: 'cover' })
      .png()

    const outStream = new Stream.PassThrough()

    file.stream.pipe(transformer).pipe(outStream)

    const key = `profile/${user.id}.png`

    const upload = s3.upload({
      Bucket: 'i.getcomet.net',
      Key: key,
      Body: outStream,
      ContentType: file.mimetype,
      ACL: 'public-read'
    })

    upload.send((err, result) => {
      if (err) {
        callback(err)
        return
      }

      callback(null, {
        // @ts-ignore
        bucket: 'i.getcomet.net',
        // @ts-ignore
        key,
        // @ts-ignore
        location:
          result.Location.replace('s3.amazonaws.com/', '') +
          '?rand=' +
          shortid.generate()
      })
    })
  }

  _removeFile(
    req: Express.Request,
    file: Express.Multer.File,
    callback: (error?: Error | null) => void
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
