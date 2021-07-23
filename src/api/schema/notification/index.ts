import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFieldConfig,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';
import { UserType } from '@api/schema/user';
import container from '@container';
import { Request } from 'express';
import { AuthenticationError, UserInputError } from 'apollo-server-express';
import {
  ContactBroker,
  ContactStatus,
  contractEventWebHookTableName,
  UserContact,
  userContactTableName,
  UserEventSubscription,
  userEventSubscriptionTableName,
} from '@models/Notification/Entity';
import { Role } from '@models/User/Entity';
import { DateTimeType, PaginateList, PaginationArgument, SortArgument, UuidType } from '../types';
import {ContractType} from "@api/schema/protocol";

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
            description: 'User ID',
          },
          broker: {
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

    const select = container.model.userContactTable().where(function () {
      if (filter.user && currentUser.role === Role.Admin) {
        this.where('user', filter.user);
      } else if (currentUser.role !== Role.Admin) {
        this.where('user', currentUser.id);
      }

      if (filter.broker) {
        this.where('broker', filter.broker);
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
            broker: {
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

    const { broker, address } = input;
    return container.model.userContactService().create(broker, address, currentUser);
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
    const { confirmationCode, address } = input;
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

export const UserEventSubscriptionType = new GraphQLObjectType<UserEventSubscription>({
  name: 'UserEventSubscriptionType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    contact: {
      type: GraphQLNonNull(UserContactType),
      description: 'Contact',
      resolve: (eventSubscription) => {
        return container.model.userContactTable().where('id', eventSubscription.contact).first();
      },
    },
    contract: {
      type: GraphQLNonNull(ContractType),
      description: 'Contract',
      resolve: async (eventSubscription) => {
        const contractWebHook = await container.model
          .contractEventWebHookTable()
          .where('id', eventSubscription.webHook)
          .first();
        return container.model
            .contractTable()
            .where('id', contractWebHook?.contract)
            .first();
      },
    },
    event: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Event',
      resolve: async (eventSubscription) => {
        const contractWebHook = await container.model
          .contractEventWebHookTable()
          .where('id', eventSubscription.webHook)
          .first();
        return contractWebHook ? contractWebHook.event : '';
      },
    },
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Date of create',
    },
  },
});

export const UserEventSubscriptionQuery: GraphQLFieldConfig<any, Request> = {
  type: UserEventSubscriptionType,
  args: {
    filter: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'UserEventSubscriptionInputType',
          fields: {
            id: {
              type: GraphQLNonNull(UuidType),
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
      .userEventSubscriptionTable()
      .where(function () {
        this.where('id', filter.id);
        if (currentUser.role !== Role.Admin) {
          this.andWhere('user', currentUser.id);
        }
      })
      .first();
  },
};

export const UserEventSubscriptionListQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(
    PaginateList('UserEventSubscriptionListQuery', GraphQLNonNull(UserEventSubscriptionType)),
  ),
  args: {
    filter: {
      type: new GraphQLInputObjectType({
        name: 'UserEventSubscriptionListQueryFilterInputType',
        fields: {
          user: {
            type: UuidType,
            description: 'User ID',
          },
          contract: {
            type: UuidType,
            description: 'Contract Id',
          },
          event: {
            type: GraphQLString,
            description: 'Event',
          },
          contactType: {
            type: UserContactBrokerEnum,
            description: 'User contact type',
          },
        },
      }),
      defaultValue: {},
    },
    sort: SortArgument(
      'UserEventSubscriptionListSortInputType',
      ['id', 'createdAt'],
      [{ column: 'createdAt', order: 'asc' }],
    ),
    pagination: PaginationArgument('UserEventSubscriptionListPaginationInputType'),
  },
  resolve: async (root, { filter, sort, pagination }, { currentUser }) => {
    if (!currentUser) {
      throw new AuthenticationError('UNAUTHENTICATED');
    }

    const select = container.model
      .userEventSubscriptionTable()
      .leftJoin(
        `${userContactTableName}`,
        `${userContactTableName}.id`,
        `${userEventSubscriptionTableName}.contact`,
      )
      .leftJoin(
        `${contractEventWebHookTableName}`,
        `${contractEventWebHookTableName}.id`,
        `${userEventSubscriptionTableName}.webHook`,
      )
      .where(function () {
        if (filter.user && currentUser.role === Role.Admin) {
          this.where(`${userContactTableName}.user`, filter.user);
        } else if (currentUser.role !== Role.Admin) {
          this.where(`${userContactTableName}.user`, currentUser.id);
        }

        if (filter.contract) {
          this.where(`${contractEventWebHookTableName}.contract`, filter.contract);
        }

        if (filter.event) {
          this.where(`${contractEventWebHookTableName}.event`, filter.event);
        }

        if (filter.contactType) {
          this.where(`${userContactTableName}.contactType`, filter.event);
        }
      });

    return {
      list: await select.clone().select(`${userEventSubscriptionTableName}.*`).orderBy(sort).limit(pagination.limit).offset(pagination.offset),
      pagination: {
        count: await select.clone().count().first(),
      },
    };
  },
};

export const UserEventSubscriptionCreateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(UserEventSubscriptionType),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'UserEventSubscriptionCreateInputType',
          fields: {
            contact: {
              type: GraphQLNonNull(GraphQLString),
              description: 'User contact id',
            },
            contract: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Contract id',
            },
            event: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Event name',
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

    const { contact: contactId, contract: contractId, event } = input;

    const contract = await container.model.contractTable().where('id', contractId).first();

    if (!contract) {
      throw new UserInputError('Contract is not found');
    }

    const contractWebHook = await container.model
      .contractEventWebHookService()
      .create(contract, event);

    const contact = await container.model
      .userContactTable()
      .where(function () {
        this.where('id', contactId);
        this.where('status', ContactStatus.Active);
        if (currentUser.role !== Role.Admin) {
          this.andWhere('user', currentUser.id);
        }
      })
      .first();

    if (!contact) {
      throw new UserInputError('User contact is not found or inactive');
    }

    return container.model.userEventSubscriptionService().create(contact, contractWebHook);
  },
};

export const UserEventSubscriptionDeleteMutation: GraphQLFieldConfig<any, Request> = {
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

    const subscription = await container.model
      .userEventSubscriptionTable()
      .select(`${userEventSubscriptionTableName}.*`)
      .leftJoin(
        `${userContactTableName}`,
        `${userContactTableName}.id`,
        `${userEventSubscriptionTableName}.contact`,
      )
      .where(function () {
        this.where(`${userEventSubscriptionTableName}.id`, id);
        if (currentUser.role !== Role.Admin) {
          this.andWhere(`${userContactTableName}.user`, currentUser.id);
        }
      })
      .first();

    if (!subscription) {
      throw new UserInputError('User event subscription is not found');
    }

    await container.model.userEventSubscriptionService().delete(subscription);

    return true;
  },
};
