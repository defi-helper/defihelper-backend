import container from '@container';
import { Request } from 'express';
import {
  GraphQLFieldConfig,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';
import { PostProvider } from '@services/SocialStats';
import dayjs, { Dayjs } from 'dayjs';
import LanguageDetect from 'languagedetect';
import { DateTimeType } from '../types';

interface MediumPostType {
  title: string;
  link: string;
  text: string;
  createdAt: Dayjs;
}

export const LandingMediumPostType = new GraphQLObjectType<MediumPostType>({
  name: 'LandingMediumPostType',
  fields: {
    title: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Title',
    },
    text: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Text',
    },
    link: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Link',
    },
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Posted at',
    },
  },
});

export const LandingMediumPostsQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLList(GraphQLNonNull(LandingMediumPostType))),
  resolve: async () => {
    const cached = await container
      .cache()
      .promises.get('defihelper:landing:posts-collecting')
      .catch(() => null);
    if (cached) {
      const parsedResponse = JSON.parse(cached);
      return (parsedResponse ?? []).map((post: MediumPostType) => ({
        ...post,
        createdAt: dayjs(post.createdAt),
      }));
    }

    const locked = await container
      .semafor()
      .lock(`defihelper:landing:posts-collecting:lock`)
      .then(() => true)
      .catch(() => false);

    if (!locked) return [];

    (async () => {
      try {
        const postsList = await container
          .socialStats()
          .post(PostProvider.Medium, 'defihelper')
          .then((rows) =>
            rows
              .map((v) => ({
                ...v,
                text: v.text
                  .replace(/(<([^>]+)>)/gi, '')
                  .slice(0, 300)
                  .split(' ')
                  .slice(0, -1)
                  .join(' ')
                  .concat('...'),
                createdAt: dayjs.unix(v.createdAt),
              }))
              .filter((v) => new LanguageDetect().detect(v.text)[0][0] === 'english'),
          );
        await container
          .cache()
          .promises.setex('defihelper:landing:posts-collecting', 86400, JSON.stringify(postsList));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }

      await container.semafor().unlock(`defihelper:landing:posts-collecting:lock`);
    })();

    return [];
  },
};
