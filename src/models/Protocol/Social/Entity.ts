import { tableFactoryLegacy } from '@services/Database';
import { PostProvider } from '@services/SocialStats';

export interface Post {
  id: string;
  protocol: string;
  provider: PostProvider;
  title: string;
  content: string;
  link: string;
  createdAt: Date;
}

export const postTableName = 'protocol_social_post';

export const postTableFactory = tableFactoryLegacy<Post>(postTableName);

export type PostTable = ReturnType<ReturnType<typeof postTableFactory>>;
