import * as Automate from '@models/Automate/Entity';
import container from '@container';
import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLEnumValueConfigMap,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';
import { DateTimeType, PaginateList, PaginationArgument, SortArgument, UuidType } from '../types';
import * as Actions from '../../../automate/action';
import * as Conditions from '../../../automate/condition';
import { WalletType } from '../user';

export const ConditionTypeEnum = new GraphQLEnumType({
  name: 'AutomateConditionTypeEnum',
  values: Object.keys(Conditions).reduce(
    (res, handler) => ({ ...res, [handler]: { value: handler } }),
    {} as GraphQLEnumValueConfigMap,
  ),
});

export const ConditionType = new GraphQLObjectType<Automate.Condition>({
  name: 'AutomateConditionType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    type: {
      type: GraphQLNonNull(ConditionTypeEnum),
      description: 'Type',
    },
    params: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Condition parameters',
      resolve: ({ params }) => JSON.stringify(params),
    },
    priority: {
      type: GraphQLNonNull(GraphQLInt),
      description: 'Execution priority (descending)',
    },
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Created at date',
    },
  },
});

export const ActionTypeEnum = new GraphQLEnumType({
  name: 'AutomateActionTypeEnum',
  values: Object.keys(Actions).reduce(
    (res, handler) => ({ ...res, [handler]: { value: handler } }),
    {} as GraphQLEnumValueConfigMap,
  ),
});

export const ActionType = new GraphQLObjectType<Automate.Action>({
  name: 'AutomateActionType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    type: {
      type: GraphQLNonNull(ActionTypeEnum),
      description: 'Type',
    },
    params: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Condition parameters',
      resolve: ({ params }) => JSON.stringify(params),
    },
    priority: {
      type: GraphQLNonNull(GraphQLInt),
      description: 'Execution priority (descending)',
    },
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Created at date',
    },
  },
});

export const TriggerTypeEnum = new GraphQLEnumType({
  name: 'AutomateTriggerTypeEnum',
  values: Object.keys(Automate.TriggerType).reduce(
    (res, handler) => ({ ...res, [handler]: { value: handler } }),
    {} as GraphQLEnumValueConfigMap,
  ),
});

export const TriggerType = new GraphQLObjectType<Automate.Trigger>({
  name: 'AutomateTriggerType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    type: {
      type: GraphQLNonNull(TriggerTypeEnum),
      description: 'Type',
    },
    wallet: {
      type: GraphQLNonNull(WalletType),
      description: 'Wallet of owner',
      resolve: ({ wallet }) => {
        return container.model.walletTable().where('id', wallet).first();
      },
    },
    name: {
      type: GraphQLNonNull(TriggerTypeEnum),
      description: 'Name',
    },
    active: {
      type: GraphQLNonNull(GraphQLBoolean),
      description: 'Is trigger active',
    },
    lastCallAt: {
      type: DateTimeType,
      description: 'Date of last call',
    },
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Created at date',
    },
    conditions: {
      type: GraphQLNonNull(
        PaginateList('AutomateConditionListType', GraphQLNonNull(ConditionType)),
      ),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'AutomateConditionListFilterInputType',
            fields: {
              id: {
                type: UuidType,
              },
              type: {
                type: ConditionTypeEnum,
              },
            },
          }),
          defaultValue: {},
        },
        sort: SortArgument(
          'AutomateConditionListSortInputType',
          ['priority'],
          [{ column: 'priority', order: 'asc' }],
        ),
        pagination: PaginationArgument('AutomateConditionListPaginationInputType'),
      },
      resolve: async (trigger, { filter, sort, pagination }) => {
        const select = container.model.automateConditionTable().where(function () {
          const { id, type } = filter;
          if (id) {
            return this.where('id', id);
          }

          if (type) {
            this.andWhere('type', type);
          }
          return null;
        });

        return {
          list: await select
            .clone()
            .orderBy(sort)
            .limit(pagination.limit)
            .offset(pagination.offset),
          pagination: {
            count: await select.clone().count().first(),
          },
        };
      },
    },
    actions: {
      type: GraphQLNonNull(PaginateList('AutomateActionListType', GraphQLNonNull(ActionType))),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'AutomateActionListFilterInputType',
            fields: {
              id: {
                type: UuidType,
              },
              type: {
                type: ConditionTypeEnum,
              },
            },
          }),
          defaultValue: {},
        },
        sort: SortArgument(
          'AutomateActionListSortInputType',
          ['priority'],
          [{ column: 'priority', order: 'asc' }],
        ),
        pagination: PaginationArgument('AutomateActionListPaginationInputType'),
      },
      resolve: async (trigger, { filter, sort, pagination }) => {
        const select = container.model.automateActionTable().where(function () {
          const { id, type } = filter;
          if (id) {
            return this.where('id', id);
          }

          if (type) {
            this.andWhere('type', type);
          }
          return null;
        });

        return {
          list: await select
            .clone()
            .orderBy(sort)
            .limit(pagination.limit)
            .offset(pagination.offset),
          pagination: {
            count: await select.clone().count().first(),
          },
        };
      },
    },
  },
});
