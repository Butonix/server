import DataLoader from 'dataloader'
import { User } from './entities/User'
import { Comment } from './entities/Comment'
import { Post } from './entities/Post'
import { Topic } from './entities/Topic'

export interface Context {
  req: any
  res: any
  userId: string
  userLoader: DataLoader<string, User>
  postLoader: DataLoader<string, Post>
  commentLoader: DataLoader<string, Comment>
  topicLoader: DataLoader<string, Topic>
}
