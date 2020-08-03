import shortid from 'shortid'
import { s3 } from './s3'

export const s3upload = async (
  Key: string,
  Body: any,
  ContentType: string
): Promise<string> => {
  const upload = s3.upload({
    Bucket: 'i.getcomet.net',
    Key,
    Body,
    ContentType,
    ACL: 'public-read'
  })

  try {
    return new Promise<string>((resolve, reject) => {
      upload.send((err, result) => {
        if (err) {
          reject(err)
        }

        resolve(
          (result.Location.replace('s3.amazonaws.com/', '') +
            '?rand=' +
            shortid.generate()) as string
        )
      })
    })
  } catch (e) {
    throw e
  }
}
