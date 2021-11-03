import { v4 as uuid } from 'uuid';
import { Protocol } from '@models/Protocol/Entity';
import { Factory } from '@services/Container';
import { PostProvider } from '@services/SocialStats';
import { Post, PostTable } from './Entity';

export type PostInput = Pick<Post, 'title' | 'content' | 'link' | 'createdAt'>;

export class ProtocolSocialService {
  constructor(readonly table: Factory<PostTable>) {}

  async savePosts(protocol: Protocol, provider: PostProvider, posts: PostInput[]) {
    await this.table().delete().where({
      protocol: protocol.id,
      provider,
    });

    const created = posts.map(({ title, content, link, createdAt }) => ({
      id: uuid(),
      protocol: protocol.id,
      provider,
      title,
      content,
      link,
      createdAt,
    }));
    await this.table().insert(created);

    return created;
  }
}
