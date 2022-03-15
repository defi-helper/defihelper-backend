import container from '@container';
import { Request } from 'express';
import { Proposal } from '@models/Governance/Entity';
import {
  GraphQLFieldConfig,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';
import { PostProvider } from '@services/SocialStats';
import { DateTimeType } from '../types';

export const LandingMediumPostType = new GraphQLObjectType<Proposal>({
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
    // const cacheGet = (): Promise<Array<{
    //   title: string;
    //   createdAt: Date;
    // }> | null> => {
    //   return new Promise((resolve) =>
    //     container.cache().get(`defihelper:landing:posts-collecting`, (err, result) => {
    //       if (err || !result) return resolve(null);
    //       return resolve(JSON.parse(result));
    //     }),
    //   );
    // };
    //
    // const cacheSet = (
    //   value: Array<{
    //     title: string;
    //     createdAt: Date;
    //   }>,
    // ): void => {
    //   container.cache().setex(`defihelper:landing:posts-collecting`, 86400, JSON.stringify(value)); //1 day
    // };
    //
    // const cached = await cacheGet();
    // if (cached) {
    //   return cached;
    // }
    //
    // const locked = await container
    //   .semafor()
    //   .lock(`defihelper:landing:posts-collecting`)
    //   .then(() => true)
    //   .catch(() => false);
    //
    // if (!locked) {
    //   return [];
    // }

    const postsList = (await container.socialStats().post(PostProvider.Medium, 'defihelper')).map(
      (v) => ({
        ...v,
        createdAt: new Date(v.createdAt * 1000),
      }),
    );
    // await cacheSet(postsList);
    //
    // await container.semafor().unlock(`defihelper:landing:posts-collecting`);
    return postsList;
  },
};
