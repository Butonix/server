import { sign, verify } from 'jsonwebtoken'
import { User } from './entities/User'
import { getRepository } from 'typeorm'

export const createAccessToken = (user: User) => {
  return sign({ userId: user.id }, process.env.ACCESS_TOKEN_SECRET!, {
    expiresIn: '15m',
  })
}

export const createRefreshToken = (user: User) => {
  return sign(
    { userId: user.id, tokenVersion: user.tokenVersion },
    process.env.REFRESH_TOKEN_SECRET!,
    {
      expiresIn: '7d',
    },
  )
}

export const sendRefreshToken = (res: any, token: string) => {
  res.cookie('jid', token, {
    httpOnly: true,
    path: '/refresh_token',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  })
}

export const getUser = (req: any): string | null => {
  const authorization = req.headers['authorization']

  if (!authorization) return null

  const token = authorization.split(' ')[1]

  if (!token) return null

  try {
    const payload: any = verify(token, process.env.ACCESS_TOKEN_SECRET!)
    return payload.userId as string
  } catch (err) {
    //console.error(err)
    return null
  }
}

export const refreshToken = async (req: any, res: any) => {
  const token = req.cookies.jid
  if (!token) {
    return res.send({ ok: false, accessToken: '' })
  }

  let payload: any = null
  try {
    payload = verify(token, process.env.REFRESH_TOKEN_SECRET!)
  } catch (err) {
    console.error(err)
    return res.send({ ok: false, accessToken: '' })
  }

  // token is valid and
  // we can send back an access token
  const user = await getRepository(User).findOne({ id: payload.userId })

  if (!user) {
    return res.send({ ok: false, accessToken: '' })
  }

  if (user.tokenVersion !== payload.tokenVersion) {
    return res.send({ ok: false, accessToken: '' })
  }

  sendRefreshToken(res, createRefreshToken(user))

  return res.send({ ok: true, accessToken: createAccessToken(user) })
}
