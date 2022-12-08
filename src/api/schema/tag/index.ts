import {
  GraphQLEnumType,
  GraphQLFieldConfig,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';
import container from '@container';
import { Request } from 'express';
import { TagType as EntityTagTypeEnum } from '@models/Tag/Entity';
import { PaginateList, PaginationArgument, SortArgument, UuidType } from '../types';

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
  type: GraphQLNonNull(PaginateList('TagsListQuery', GraphQLNonNull(TagType))),
  args: {
    sort: SortArgument(
      'TagsListSortInputType',
      ['position', 'name'],
      [{ column: 'position', order: 'asc' }],
    ),
    pagination: PaginationArgument('TagsListPaginationInputType'),
  },
  resolve: async (root, { sort, pagination }) => {
    const select = container.model.tagTable();

    return {
      list: await select.clone().orderBy(sort).limit(pagination.limit).offset(pagination.offset),
      pagination: {
        count: await select.clone().count().first(),
      },
    };
  },
};
