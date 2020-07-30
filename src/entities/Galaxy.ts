import { Field, ID, ObjectType } from 'type-graphql'
import { Column, Entity, JoinTable, ManyToMany, PrimaryColumn } from 'typeorm'
import { Lazy } from '../lazy'
import { Planet } from './Planet'

@ObjectType()
@Entity()
export class Galaxy {
  @Field(() => ID)
  @PrimaryColumn()
  name: string

  @Field()
  @Column()
  fullName: string

  @Field()
  @Column()
  icon: string

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  description?: string

  @ManyToMany(
    () => Planet,
    (planet) => planet.galaxy
  )
  @JoinTable()
  planets: Lazy<Planet[]>

  @Field({ nullable: true })
  planetCount: number
}
