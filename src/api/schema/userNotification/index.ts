import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFieldConfig,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from 'graphql';
import container from '@container';
import { Request } from 'express';
import * as UserNotification from '@models/UserNotification/Entity';
import { AuthenticationError } from 'apollo-server-express';

export const UserNotificationTypeEnum = new GraphQLEnumType({
  name: 'UserNotificationTypeEnum',
  values: Object.keys(UserNotification.UserNotificationType).reduce(
    (res, type) => ({ ...res, [type]: { value: type } }),
    {},
  ),
});

export const UserNotificationType = new GraphQLObjectType<UserNotification.UserNotification>({
  name: 'UserNotificationType',
  fields: {
    type: {
      type: GraphQLNonNull(UserNotificationTypeEnum),
      description: 'Type',
    },
  },
});

export const UserNotificationEnabledListQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLList(GraphQLNonNull(UserNotificationType))),
  resolve: async (root, _, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    return container.model.userNotificationTable().where({
      user: currentUser.id,
    });
  },
};

export const UserNotificationEnableMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    type: {
      type: GraphQLNonNull(UserNotificationTypeEnum),
    },
  },
  resolve: async (root, { type }, { currentUser }) => {
    if (!currentUser) {
      throw new AuthenticationError('UNAUTHENTICATED');
    }

    await container.model.userNotificationService().enable(currentUser, type);
    return true;
  },
};
export const UserNotificationDisableMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    type: {
      type: GraphQLNonNull(UserNotificationTypeEnum),
    },
  },
  resolve: async (root, { type }, { currentUser }) => {
    if (!currentUser) {
      throw new AuthenticationError('UNAUTHENTICATED');
    }

    await container.model.userNotificationService().disable(currentUser, type);
    return true;
  },
};
