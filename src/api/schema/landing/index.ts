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

const cacheGet = (): Promise<Array<MediumPostType> | null> => {
  return new Promise((resolve) =>
    container.cache().get('defihelper:landing:posts-collecting', (err, result) => {
      if (err || !result) return resolve(null);
      const list: Array<MediumPostType> = JSON.parse(result);

      return resolve(list.map((v) => ({ ...v, createdAt: dayjs(v.createdAt) })));
    }),
  );
};

const cacheSet = (value: Array<MediumPostType>): Promise<string> => {
  return new Promise((resolve, reject) =>
    container.cache().setex(
      'defihelper:landing:posts-collecting',
      86400, // 1 day
      JSON.stringify(value),
      (err, reply) => {
        if (err) return reject(err);

        return resolve(reply);
      },
    ),
  );
};

export const LandingMediumPostsQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLList(GraphQLNonNull(LandingMediumPostType))),
  resolve: async () => {
    const cached = await cacheGet();
    if (cached) return cached;

    const locked = await container
      .semafor()
      .lock(`defihelper:landing:posts-collecting:lock`)
      .then(() => true)
      .catch(() => false);

    if (!locked) return [];

    (async () => {
      const postsList = await container
        .socialStats()
        .post(PostProvider.Medium, 'defihelper')
        .then((rows) =>
          rows.map((v) => ({
            ...v,
            text: v.text
              .replace(/(<([^>]+)>)/gi, '')
              .slice(0, 300)
              .split(' ')
              .slice(0, -1)
              .concat('...')
              .join(' '),
            createdAt: dayjs.unix(v.createdAt),
          })),
        );
      await cacheSet(postsList);
      await container.semafor().unlock(`defihelper:landing:posts-collecting:lock`);
    })();

    return [];
  },
};
