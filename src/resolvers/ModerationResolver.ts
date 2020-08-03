import { RepositoryInjector } from '../RepositoryInjector'
import { Arg, Ctx, ID, Mutation, UseMiddleware } from 'type-graphql'
import { Planet } from '../entities/Planet'
import { Context } from '../Context'
import { GraphQLUpload, FileUpload } from 'graphql-upload'
import { s3upload } from '../S3Storage'
import sharp from 'sharp'
import { Stream } from 'stream'
import { RequiresMod } from '../middleware/RequiresMod'

export class ModerationResolver extends RepositoryInjector {
  @Mutation(() => Boolean)
  @UseMiddleware(RequiresMod)
  async removePost(
    @Arg('planetName', () => ID) planetName: string,
    @Arg('postId', () => ID) postId: string,
    @Arg('removedReason') removedReason: string
  ) {
    await this.postRepository.update(postId, { removed: true, removedReason })
  }

  @Mutation(() => Boolean)
  @UseMiddleware(RequiresMod)
  async removeComment(
    @Arg('planetName', () => ID) planetName: string,
    @Arg('commentId', () => ID) commentId: string,
    @Arg('removedReason') removedReason: string
  ) {
    await this.commentRepository.update(commentId, {
      removed: true,
      removedReason
    })
  }

  @Mutation(() => Boolean)
  @UseMiddleware(RequiresMod)
  async banUserFromPlanet(
    @Arg('planetName', () => ID) planetName: string,
    @Arg('bannedUserId', () => ID) bannedUserId: string
  ) {
    await this.planetRepository
      .createQueryBuilder()
      .relation(Planet, 'bannedUsers')
      .of(planetName)
      .add(bannedUserId)
  }

  @Mutation(() => Boolean)
  @UseMiddleware(RequiresMod)
  async unbanUserFromPlanet(
    @Arg('planetName', () => ID) planetName: string,
    @Arg('bannedUserId', () => ID) bannedUserId: string
  ) {
    await this.planetRepository
      .createQueryBuilder()
      .relation(Planet, 'bannedUsers')
      .of(planetName)
      .remove(bannedUserId)
  }

  @Mutation(() => Boolean)
  @UseMiddleware(RequiresMod)
  async setPlanetThemeColor(
    @Arg('planetName', () => ID) planetName: string,
    @Arg('themeColor') themeColor: string
  ) {
    if (!/^#[0-9A-F]{6}$/i.test(themeColor)) throw new Error('Invalid color')
    await this.planetRepository.update(planetName, { themeColor })
  }

  @Mutation(() => Boolean)
  @UseMiddleware(RequiresMod)
  async uploadPlanetAvatarImage(
    @Arg('planetName', () => ID) planetName: string,
    @Arg('file', () => GraphQLUpload) file: FileUpload
  ) {
    const { createReadStream, mimetype } = await file

    if (mimetype !== 'image/jpeg' && mimetype !== 'image/png')
      throw new Error('Image must be PNG or JPEG')

    const transformer = sharp()
      .resize(370, 370, { fit: 'cover' })
      .png()

    const outStream = new Stream.PassThrough()
    createReadStream()
      .pipe(transformer)
      .pipe(outStream)

    const url = await s3upload(
      `planet/${planetName}/avatar.png`,
      outStream,
      file.mimetype
    )

    await this.planetRepository.update(planetName, { avatarImageUrl: url })
    return true
  }

  @Mutation(() => Boolean)
  @UseMiddleware(RequiresMod)
  async uploadPlanetCardImage(
    @Arg('planetName', () => ID) planetName: string,
    @Arg('file', () => GraphQLUpload) file: FileUpload
  ) {
    const { createReadStream, mimetype } = await file

    if (mimetype !== 'image/jpeg' && mimetype !== 'image/png')
      throw new Error('Image must be PNG or JPEG')

    const transformer = sharp()
      .resize(1920, 1080, { fit: 'cover' })
      .png()

    const outStream = new Stream.PassThrough()
    createReadStream()
      .pipe(transformer)
      .pipe(outStream)

    const url = await s3upload(
      `planet/${planetName}/card.png`,
      outStream,
      file.mimetype
    )

    await this.planetRepository.update(planetName, { cardImageUrl: url })
    return true
  }

  @Mutation(() => Boolean)
  @UseMiddleware(RequiresMod)
  async setPlanetDescription(
    @Arg('planetName', () => ID) planetName: string,
    @Arg('description') description: string
  ) {
    if (description.length > 10000)
      throw new Error('Custom name must be 10000 characters or less')
    await this.planetRepository.update(planetName, { description })
  }

  @Mutation(() => Boolean)
  @UseMiddleware(RequiresMod)
  async setPlanetCustomName(
    @Arg('planetName', () => ID) planetName: string,
    @Arg('customName') customName: string
  ) {
    if (customName.length > 50)
      throw new Error('Custom name must be 50 characters or less')
    await this.planetRepository.update(planetName, { customName })
  }
}
