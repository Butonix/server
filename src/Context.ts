import DataLoader from 'dataloader'
import { User } from './entities/User'
import { Comment } from './entities/Comment'
import { Post } from './entities/Post'
import { Topic } from './entities/Topic'
import { PostView } from './entities/PostView'

export interface Context {
  req: any
  res: any
  userId: string
  userLoader: DataLoader<string, User>
  postLoader: DataLoader<string, Post>
  commentLoader: DataLoader<string, Comment>
  topicLoader: DataLoader<string, Topic>
  postViewLoader: DataLoader<PostViewKey, PostView>
}

type PostViewKey = {
  userId: string
  postId: string
}
