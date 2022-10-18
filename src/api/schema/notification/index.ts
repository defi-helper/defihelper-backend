import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFieldConfig,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';
import { Request } from 'express';
import { AuthenticationError, UserInputError, withFilter } from 'apollo-server-express';
import { UserType } from '@api/schema/user';
import container from '@container';
import { ContactBroker, ContactStatus, UserContact } from '@models/Notification/Entity';
import { Role } from '@models/User/Entity';
import { UserNotificationType } from '@models/UserNotification/Entity';
import { DateTimeType, PaginateList, PaginationArgument, SortArgument, UuidType } from '../types';

export const UserContactBrokerEnum = new GraphQLEnumType({
  name: 'UserContactBrokerEnum',
  values: {
    [ContactBroker.Email]: {
      description: 'Email',
    },
    [ContactBroker.Telegram]: {
      description: 'Telegram',
    },
  },
});

export const UserContactStatusEnum = new GraphQLEnumType({
  name: 'UserContactStatusEnum',
  values: {
    [ContactStatus.Active]: {
      description: 'Has been activated',
    },
    [ContactStatus.Inactive]: {
      description: 'Has not been activated yet',
    },
  },
});

export const UserContactType = new GraphQLObjectType<UserContact>({
  name: 'UserContactType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    user: {
      type: GraphQLNonNull(UserType),
      description: 'User',
      resolve: (userContact) => {
        return container.model.userTable().where('id', userContact.user).first();
      },
    },
    broker: {
      type: GraphQLNonNull(UserContactBrokerEnum),
      description: 'Type of the contact',
    },
    address: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Address',
    },
    name: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Name',
    },
    status: {
      type: GraphQLNonNull(UserContactStatusEnum),
      description: 'Status',
    },
    confirmationCode: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Confirmation Code',
      resolve: (userContact) => {
        return userContact.broker === ContactBroker.Telegram ? userContact.confirmationCode : '';
      },
    },
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Date of create',
    },
    activatedAt: {
      type: DateTimeType,
      description: 'Date of activated',
    },
  },
});

export const UserContactQuery: GraphQLFieldConfig<any, Request> = {
  type: UserContactType,
  args: {
    filter: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'UserContactFilterInputType',
          fields: {
            id: {
              type: GraphQLNonNull(GraphQLString),
            },
          },
        }),
      ),
    },
  },
  resolve: async (root, { filter }, { currentUser }) => {
    if (!currentUser) {
      throw new AuthenticationError('UNAUTHENTICATED');
    }

    return container.model
      .userContactTable()
      .where(function () {
        this.where('id', filter.id);
        if (currentUser.role !== Role.Admin) {
          this.andWhere('user', currentUser.id);
        }
      })
      .first();
  },
};

export const UserContactListQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(PaginateList('UserContactListQuery', GraphQLNonNull(UserContactType))),
  args: {
    filter: {
      type: new GraphQLInputObjectType({
        name: 'UserContactListQueryFilterInputType',
        fields: {
          user: {
            type: UuidType,
          },
          broker: {
            type: UserContactBrokerEnum,
            description: 'Type',
          },
          status: {
            type: UserContactStatusEnum,
            description: 'Status',
          },
          search: {
            type: GraphQLString,
          },
        },
      }),
      defaultValue: {},
    },
    sort: SortArgument(
      'UserContactListSortInputType',
      ['id', 'createdAt'],
      [{ column: 'createdAt', order: 'asc' }],
    ),
    pagination: PaginationArgument('UserContactListPaginationInputType'),
  },
  resolve: async (root, { filter, sort, pagination }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const select = container.model.userContactTable().where(function () {
      if (typeof filter.user === 'string' && currentUser.role === Role.Admin) {
        this.andWhere('user', filter.user);
      } else {
        this.andWhere('user', currentUser.id);
      }
      if (filter.broker) {
        this.where('broker', filter.broker);
      }
      if (filter.status) {
        this.where('status', filter.status);
      }
      if (filter.search !== undefined && filter.search !== '') {
        this.andWhere(function () {
          this.where('name', 'iLike', `%${filter.search}%`);
        });
      }
    });

    return {
      list: await select.clone().orderBy(sort).limit(pagination.limit).offset(pagination.offset),
      pagination: {
        count: await select.clone().count().first(),
      },
    };
  },
};

export const UserContactCreateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(UserContactType),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'UserContactCreateInputType',
          fields: {
            broker: {
              type: GraphQLNonNull(UserContactBrokerEnum),
              description: 'Type',
            },
            address: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Address',
            },
            name: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Name',
            },
          },
        }),
      ),
    },
  },
  resolve: async (root, { input }, { currentUser }) => {
    if (!currentUser) {
      throw new AuthenticationError('UNAUTHENTICATED');
    }

    const { broker, address, name } = input;
    const contact = await container.model
      .userContactService()
      .create(broker, address, currentUser, name);

    await Promise.all(
      Object.values(UserNotificationType).map((t) =>
        container.model
          .userNotificationService()
          .enable(contact, t as UserNotificationType, '12:00'),
      ),
    );

    return contact;
  },
};

export const UserContactUpdateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(UserContactType),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'UserContactUpdateInputType',
          fields: {
            name: {
              type: GraphQLString,
              description: 'Name',
            },
          },
        }),
      ),
    },
  },
  resolve: async (root, { id, input }, { currentUser }) => {
    if (!currentUser) {
      throw new AuthenticationError('UNAUTHENTICATED');
    }

    const contact = await container.model.userContactTable().where('id', id).first();
    if (!contact) throw new UserInputError('Contact not found');

    const { name } = input;
    const updated = await container.model.userContactService().update({
      ...contact,
      name: typeof name === 'string' ? name : contact.name,
    });

    return updated;
  },
};

export const UserContactEmailConfirmMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'UserContactConfirmEmailInputType',
          fields: {
            confirmationCode: {
              type: GraphQLNonNull(GraphQLString),
              description: 'code',
            },
          },
        }),
      ),
    },
  },
  resolve: async (root, { input }) => {
    const { confirmationCode } = input;
    const contact = await container.model
      .userContactTable()
      .where({
        confirmationCode,
      })
      .first();

    if (!contact || contact.broker !== ContactBroker.Email) {
      return false;
    }

    await container.model.userContactService().activate(contact);

    return true;
  },
};

export const UserContactDeleteMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
  },
  resolve: async (root, { id }, { currentUser }) => {
    if (!currentUser) {
      throw new AuthenticationError('UNAUTHENTICATED');
    }

    const userContact = await container.model
      .userContactTable()
      .where(function () {
        this.where('id', id);
        if (currentUser.role !== Role.Admin) {
          this.where('user', currentUser.id);
        }
      })
      .first();

    if (!userContact) {
      throw new UserInputError('User contact is not found');
    }

    await container.model.userContactService().delete(userContact);

    return true;
  },
};

export const OnUserContactActivated: GraphQLFieldConfig<{ id: string }, Request> = {
  type: GraphQLNonNull(UserContactType),
  args: {
    filter: {
      type: new GraphQLInputObjectType({
        name: 'OnUserContactActivatedFilterInputType',
        fields: {
          user: {
            type: GraphQLList(GraphQLNonNull(UuidType)),
          },
        },
      }),
      defaultValue: {},
    },
  },
  subscribe: withFilter(
    () => container.cacheSubscriber('defihelper:channel:onUserContactActivated').asyncIterator(),
    async ({ id }, { filter }) => {
      const contact = await container.model.userContactTable().where('id', id).first();
      if (!contact) return false;

      let result = true;
      if (Array.isArray(filter.user) && filter.user.length > 0) {
        result = result && filter.user.includes(contact.user);
      }

      return result;
    },
  ),
  resolve: ({ id }) => {
    return container.model.userContactTable().where('id', id).first();
  },
};
