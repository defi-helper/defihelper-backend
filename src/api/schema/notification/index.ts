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
import { AuthenticationError, UserInputError, ValidationError } from 'apollo-server-express';
import { ContactBroker, ContactStatus, UserContact } from "@models/Notification/Entity";

export const UserContactBroker = new GraphQLEnumType({
    name: 'UserContactBroker',
    values: {
        [ContactBroker.Email]: {
            description: 'Email',
        },
        [ContactBroker.Telegram]: {
            description: 'Telegram',
        },
    },
});

export const UserContactStatus = new GraphQLEnumType({
    name: 'UserContactBroker',
    values: {
        [ContactStatus.Active]: {
            description: 'Has been activated',
        },
        [ContactStatus.Inactive]: {
            description: 'Has not been activated yet',
        },
    },
});

export const UserContactTpe = new GraphQLObjectType<UserContact>({
    name: 'UserContactTpe',
    fields: {
        id: {
            type: GraphQLNonNull(UuidType),
            description: 'Identificator',
        },
        user: {
            type: UserType,
            description: 'User',
            resolve: (userContact) => {
                return container.model.userTable().where('id', userContact.user).first();
            },
        },
        type: {
            type: GraphQLNonNull(UserContactBroker),
            description: 'Type of the contact',
        },
        address: {
            type: GraphQLNonNull(GraphQLString),
            description: 'Address',
        },
        status: {
            type: GraphQLNonNull(UserContactStatus),
            description: 'Status',
        },
        confirmationCode: {
            type: GraphQLNonNull(UserContactBroker),
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
    type: UserContactTpe,
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

        return container.model.userContactTable()
            .where('id', filter.id)
            .andWhere('user', currentUser.id).first();
    },
};

export const UserContactListQuery: GraphQLFieldConfig<any, Request> = {
    type: GraphQLNonNull(PaginateList('UserContactListQuery', GraphQLNonNull(UserContactTpe))),
    args: {
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

        const select = container.model.userContactTable().where('user', currentUser.id);

        return {
            list: await select.clone().orderBy(sort).limit(pagination.limit).offset(pagination.offset),
            pagination: {
                count: await select.clone().count().first(),
            },
        };
    },
};

export const UserContactCreateMutation: GraphQLFieldConfig<any, Request> = {
    type: GraphQLNonNull(UserContactTpe),
    args: {
        input: {
            type: GraphQLNonNull(
                new GraphQLInputObjectType({
                    name: 'UserContactCreateInputType',
                    fields: {
                        type: {
                            type: GraphQLNonNull(UserContactTpe),
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
        return await container.model.userContactService().create(type, address, currentUser);
    },
};

export const UserContactEmailConfirmMutation: GraphQLFieldConfig<any, Request> = {
    type: GraphQLNonNull(UserContactTpe),
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
        const contact = await container.model.userContactTable()
            .where('confirmationCode', confirmationCode)
            .first();
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

        const userContact = await container.model.userContactTable()
            .where('id', id)
            .andWhere('user', currentUser.id).first();

        if (!userContact) throw new UserInputError('User contact is not found');

        await container.model.userContactService().delete(userContact);

        return true;
    },
};
