import {
  GraphQLEnumType,
  GraphQLFieldConfig,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';
import container from '@container';
import { Request } from 'express';
import { TagType as EntityTagTypeEnum } from '@models/Tag/Entity';
import { UuidType } from '../types';

export const TagTypeEnum = new GraphQLEnumType({
  name: 'TagTypeEnum',
  values: Object.values(EntityTagTypeEnum).reduce(
    (res, type) => ({ ...res, [type]: { value: type } }),
    {},
  ),
});

export const TagType = new GraphQLObjectType({
  name: 'TagType',
  fields: {
    name: {
      type: GraphQLNonNull(GraphQLString),
    },
    type: {
      type: GraphQLNonNull(TagTypeEnum),
    },
    id: {
      type: GraphQLNonNull(UuidType),
    },
  },
});

export const TagsListQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLList(GraphQLNonNull(TagType))),
  resolve: () => container.model.tagTable(),
};
