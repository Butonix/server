import {
  Arg,
  Args,
  Ctx,
  FieldResolver,
  ID,
  Mutation,
  Query,
  Resolver,
  Root,
  UseMiddleware
} from 'type-graphql'
import { RepositoryInjector } from '../RepositoryInjector'
import { RequiresAuth } from '../RequiresAuth'
import { CreatePlanetArgs } from '../args/CreatePlanetArgs'
import { Planet } from '../entities/Planet'
import { galaxiesList } from '../galaxiesList'
import { Galaxy } from '../entities/Galaxy'
import { Context } from '../Context'
import { User } from '../entities/User'

@Resolver(() => Planet)
export class PlanetResolver extends RepositoryInjector {
  @UseMiddleware(RequiresAuth)
  @Mutation(() => Boolean)
  async createPlanet(
    @Args() { name, description, galaxy }: CreatePlanetArgs,
    @Ctx() { userId }: Context
  ) {
    if (await this.planetExists(name)) throw new Error('Planet already exists')

    const user = await this.userRepository
      .createQueryBuilder('user')
      .whereInIds(userId)
      .leftJoinAndSelect('user.moderatedPlanets', 'moderatedPlanet')
      .getOne()
    if ((await user.moderatedPlanets).length >= 10)
      throw new Error('Cannot moderate more than 10 planets')

    if (!galaxiesList.map((g) => g.name).includes(galaxy))
      throw new Error('Invalid galaxy: ' + galaxy)

    await this.planetRepository.save({
      name,
      description,
      galaxy: galaxiesList.find((ga) => ga.name === galaxy),
      createdAt: new Date(),
      creatorId: userId,
      moderators: [{ id: userId }],
      users: [{ id: userId }]
    } as Planet)

    return true
  }

  @Query(() => Boolean)
  async planetExists(@Arg('name') name: string) {
    const foundPlanet = await this.planetRepository.findOne({
      where: `"name" ILIKE '${name.replace(/_/g, '\\_')}'`
    })
    return !!foundPlanet
  }

  @Query(() => [Galaxy])
  galaxies() {
    return galaxiesList
  }

  @Query(() => Planet, { nullable: true })
  async planet(@Arg('planetName', () => ID) planetName: string) {
    return this.planetRepository
      .createQueryBuilder('planet')
      .andWhere('planet.name ILIKE :planetName', {
        planetName: planetName.replace(/_/g, '\\_')
      })
      .loadRelationCountAndMap('planet.userCount', 'planet.users')
      .leftJoinAndSelect('planet.moderators', 'moderator')
      .leftJoinAndSelect('planet.galaxy', 'galaxy')
      .getOne()
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(() => Boolean)
  async joinPlanet(
    @Arg('planetName', () => ID) planetName: string,
    @Ctx() { userId }: Context
  ) {
    await this.userRepository
      .createQueryBuilder()
      .relation(User, 'planets')
      .of(userId)
      .add(planetName)
    return true
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(() => Boolean)
  async leavePlanet(
    @Arg('planetName', () => ID) planetName: string,
    @Ctx() { userId }: Context
  ) {
    await this.userRepository
      .createQueryBuilder()
      .relation(User, 'planets')
      .of(userId)
      .remove(planetName)
    return true
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(() => Boolean)
  async blockPlanet(
    @Arg('planetName', () => ID) planetName: string,
    @Ctx() { userId }: Context
  ) {
    await this.userRepository
      .createQueryBuilder()
      .relation(User, 'planets')
      .of(userId)
      .remove(planetName)

    await this.userRepository
      .createQueryBuilder()
      .relation(User, 'blockedPlanets')
      .of(userId)
      .add(planetName)
    return true
  }

  @UseMiddleware(RequiresAuth)
  @Mutation(() => Boolean)
  async unblockPlanet(
    @Arg('planetName', () => ID) planetName: string,
    @Ctx() { userId }: Context
  ) {
    await this.userRepository
      .createQueryBuilder()
      .relation(User, 'blockedPlanets')
      .of(userId)
      .remove(planetName)
    return true
  }

  @Query(() => [Planet])
  async popularPlanets(
    @Arg('galaxyName', () => ID, { nullable: true }) galaxyName: string
  ) {
    const qb = await this.planetRepository
      .createQueryBuilder('planet')
      .addSelect('COUNT(posts.id)', 'planet_total')
      .leftJoin(
        'planet.posts',
        'posts',
        "posts.deleted = false AND posts.createdAt > NOW() - INTERVAL '1 day'"
      )
      .groupBy('planet.name')
      .orderBy('planet_total', 'DESC')
      .having('COUNT(posts.id) > 0')
      .take(5)

    if (galaxyName) {
      qb.where('planet.galaxy = :galaxyName', { galaxyName })
    }

    const planets = await qb.getMany()

    planets.forEach((planet) => (planet.postCount = planet.total))

    return planets
  }

  @Query(() => [Planet])
  async allPlanets() {
    return this.planetRepository
      .createQueryBuilder('planet')
      .orderBy('planet.name', 'ASC')
      .leftJoinAndSelect('planet.galaxy', 'galaxy')
      .loadRelationCountAndMap('planet.userCount', 'planet.users')
      .getMany()
  }

  @Query(() => [Planet])
  async searchPlanets(@Arg('search') search: string) {
    if (!search) return []

    return this.planetRepository
      .createQueryBuilder('planet')
      .where('planet.name ILIKE :name', {
        name: '%' + search.toLowerCase().replace(/ /g, '_') + '%'
      })
      .take(10)
      .getMany()
  }

  @Query(() => [Planet])
  async joinedPlanets(@Ctx() { userId }: Context) {
    if (!userId) return []

    let planets = await this.userRepository
      .createQueryBuilder()
      .relation(User, 'planets')
      .of(userId)
      .loadMany()

    if (planets.length === 0) return []

    planets = await this.planetRepository
      .createQueryBuilder('planet')
      .whereInIds(planets.map((planet) => planet.name))
      .addOrderBy('planet.name', 'ASC')
      .loadRelationCountAndMap(
        'planet.postCount',
        'planet.posts',
        'post',
        (qb) => {
          return qb
            .andWhere('post.deleted = false')
            .andWhere("post.createdAt > NOW() - INTERVAL '1 day'")
        }
      )
      .getMany()

    return planets
  }

  @FieldResolver()
  async joined(@Root() planet: Planet, @Ctx() { userId }: Context) {
    if (!userId) return false

    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId: userId })
      .leftJoinAndSelect('user.planets', 'planet', 'planet.name = :name', {
        name: planet.name
      })
      .getOne()

    return Boolean((await user.planets).length)
  }

  @FieldResolver()
  async blocking(@Root() planet: Planet, @Ctx() { userId }: Context) {
    if (!userId) return false

    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId: userId })
      .leftJoinAndSelect(
        'user.blockedPlanets',
        'blockedPlanet',
        'blockedPlanet.name = :name',
        {
          name: planet.name
        }
      )
      .getOne()

    return Boolean((await user.blockedPlanets).length)
  }
}
