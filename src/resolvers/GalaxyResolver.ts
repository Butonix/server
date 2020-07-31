import { Arg, ID, Query, Resolver } from 'type-graphql'
import { Galaxy } from '../entities/Galaxy'
import { RepositoryInjector } from '../RepositoryInjector'

@Resolver(() => Galaxy)
export class GalaxyResolver extends RepositoryInjector {
  @Query(() => Galaxy, { nullable: true })
  async galaxy(@Arg('galaxyName', () => ID) galaxyName: string) {
    return this.galaxyRepository
      .createQueryBuilder('galaxy')
      .where('galaxy.name = :galaxyName', { galaxyName })
      .loadRelationCountAndMap('galaxy.planetCount', 'galaxy.planets')
      .getOne()
  }
}
