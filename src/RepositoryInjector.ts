import { Post } from './entities/Post'
import { InjectRepository } from 'typeorm-typedi-extensions'
import { User } from './entities/User'
import { Repository, TreeRepository } from 'typeorm'
import { Comment } from './entities/Comment'
import { PostEndorsement } from './entities/PostEndorsement'
import { CommentEndorsement } from './entities/CommentEndorsement'
import { Topic } from './entities/Topic'
import { PostView } from './entities/PostView'

export class RepositoryInjector {
  @InjectRepository(Comment) readonly commentRepository: TreeRepository<Comment>
  @InjectRepository(Post) readonly postRepository: Repository<Post>
  @InjectRepository(User) readonly userRepository: Repository<User>
  @InjectRepository(PostEndorsement) readonly postEndorsementRepository: Repository<PostEndorsement>
  @InjectRepository(CommentEndorsement) readonly commentEndorsementRepository: Repository<
    CommentEndorsement
  >
  @InjectRepository(Topic) readonly topicRepository: Repository<Topic>
  @InjectRepository(PostView) readonly postViewRepository: Repository<PostView>
}
