import { User } from './entities/User'
import { Comment } from './entities/Comment'
import { Post } from './entities/Post'
import { PostEndorsement } from './entities/PostEndorsement'
import { CommentEndorsement } from './entities/CommentEndorsement'
import { Planet } from './entities/Planet'
import { Galaxy } from './entities/Galaxy'
import { PostView } from './entities/PostView'
import { ReplyNotification } from './entities/ReplyNotification'
import { PostResolver } from './resolvers/PostResolver'
import { UserResolver } from './resolvers/UserResolver'
import { AuthResolver } from './resolvers/AuthResolver'
import { CommentResolver } from './resolvers/CommentResolver'
import { FiltersResolver } from './resolvers/FiltersResolver'
import { NotificationResolver } from './resolvers/NotificationResolver'
import { PlanetResolver } from './resolvers/PlanetResolver'

export const entities = [
  User,
  Comment,
  Post,
  PostEndorsement,
  CommentEndorsement,
  Planet,
  Galaxy,
  PostView,
  ReplyNotification
]
export const resolvers = [
  PostResolver,
  UserResolver,
  AuthResolver,
  CommentResolver,
  FiltersResolver,
  NotificationResolver,
  PlanetResolver
]
