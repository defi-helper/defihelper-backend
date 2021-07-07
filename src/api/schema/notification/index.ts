import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFieldConfig,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';
import { DateTimeType, PaginateList, PaginationArgument, SortArgument, UuidType} from '../types';
import { UserType} from '@api/schema/user';
import { Status} from '@models/Proposal/Entity';
import container from '@container';
import { Request} from 'express';
import { AuthenticationError, UserInputError } from 'apollo-server-express';
import { ContactBroker, ContactStatus, UserContact } from "@models/Notification/Entity";
import { Role } from "@models/User/Entity";

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
    type: {
      type: GraphQLNonNull(UserContactBrokerEnum),
      description: 'Type of the contact',
    },
    address: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Address',
    },
    status: {
      type: GraphQLNonNull(UserContactStatusEnum),
      description: 'Status',
    },
    confirmationCode: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Confirmation Code',
    },
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Date of crate',
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

    return container.model.userContactTable().where(function() {
      this.where('id', filter.id);
      if (currentUser.role !== Role.Admin) {
        this.andWhere('user', currentUser.id);
      }
    }).first()
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
            description: 'User ID',
          },
          type: {
            type: UserContactBrokerEnum,
            description: 'Type',
          },
          status: {
            type: UserContactStatusEnum,
            description: 'Status',
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
    if (!currentUser) {
      throw new AuthenticationError('UNAUTHENTICATED');
    }

    let select = container.model.userContactTable().where(function () {
      if (filter.user && currentUser.role === Role.Admin) {
        this.where('user', filter.user);
      } else {
        this.where('user', currentUser.id);
      }

      if (filter.type) {
        this.where('type', filter.type);
      }

      if (filter.status) {
        this.where('status', filter.status);
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
            type: {
              type: GraphQLNonNull(UserContactBrokerEnum),
              description: 'Type',
            },
            address: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Address',
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

    const { type, address } = input;
    return container.model.userContactService().create(type, address, currentUser);
  },
};

export const UserContactEmailConfirmMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(UserContactType),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'UserContactConfirmEmailInputType',
          fields: {
            address: {
              type: GraphQLNonNull(GraphQLString),
              description: 'address',
            },
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
    const { confirmationCode, address } = input;
    const contact = await container.model.userContactTable().where({
      address,
      confirmationCode
    }).first()

    if (!contact || contact.type !== ContactBroker.Email) {
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

    const userContact = await container.model.userContactTable().where(function () {
      this.where('id', id);
      if (currentUser.role !== Role.Admin) {
        this.where('user', currentUser.id);
      }
    }).first();

    if (!userContact) throw new UserInputError('User contact is not found');

    await container.model.userContactService().delete(userContact);

    return true;
  },
};
