import container from '@container';
import { PostInput } from '@models/Protocol/Social/Service';
import { Process } from '@models/Queue/Entity';
import { PostProvider } from '@services/SocialStats';
import dayjs from 'dayjs';

export interface Params {
  provider: PostProvider;
  protocol: string;
}

export default async (process: Process) => {
  const { provider, protocol: protocolId } = process.task.params as Params;

  const protocol = await container.model.protocolTable().where('id', protocolId).first();
  if (!protocol) throw new Error('Protocol not found');

  const links = (protocol.links.social ?? [])
    .filter(({ name }) => name.toLowerCase() === provider)
    .map(({ value }) => value);
  const ids = links
    .map((link) => (link.match(/\/([^/]+)$/i) ?? [])[1])
    .filter((v) => typeof v === 'string');

  const socialStatsGateway = container.socialStats();
  const postsData = await Promise.all(ids.map((id) => socialStatsGateway.post(provider, id)));
  const posts = postsData
    .flat(1)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5)
    .map<PostInput>(({ title, text, link, createdAt }) => ({
      title,
      content: text,
      link,
      createdAt: dayjs.unix(createdAt).toDate(),
    }));

  await container.model.protocolSocialService().savePosts(protocol, provider, posts);

  return process.done();
};
