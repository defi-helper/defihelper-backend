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
  values: Object.values(UserNotification.UserNotificationType).reduce(
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

export const UserNotificationListQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLList(GraphQLNonNull(UserNotificationType))),
  resolve: async (root, _, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    return container.model.userNotificationTable().where({
      user: currentUser.id,
    });
  },
};

export const UserNotificationToggleMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    type: {
      type: GraphQLNonNull(UserNotificationTypeEnum),
    },
    state: {
      type: GraphQLNonNull(GraphQLBoolean),
    },
  },
  resolve: async (root, { type, state }, { currentUser }) => {
    if (!currentUser) {
      throw new AuthenticationError('UNAUTHENTICATED');
    }

    if (state) {
      await container.model.userNotificationService().enable(currentUser, type);
      return true;
    }

    await container.model.userNotificationService().disable(currentUser, type);
    return true;
  },
};
