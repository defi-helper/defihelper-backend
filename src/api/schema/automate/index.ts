import * as Automate from '@models/Automate/Entity';
import { AuthenticationError, UserInputError } from 'apollo-server-express';
import { Request } from 'express';
import container from '@container';
import { tableName as walletTableName } from '@models/Wallet/Entity';
import {
  GraphQLBoolean,
  GraphQLFieldConfig,
  GraphQLEnumType,
  GraphQLEnumValueConfigMap,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';
import {
  DateTimeType,
  onlyAllowed,
  PaginateList,
  PaginationArgument,
  SortArgument,
  UuidType,
} from '../types';
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
          this.where('trigger', trigger.id);

          const { id, type } = filter;
          if (id) {
            return this.andWhere('id', id);
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
          this.where('trigger', trigger.id);

          const { id, type } = filter;
          if (id) {
            return this.andWhere('id', id);
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

export const TriggerQuery: GraphQLFieldConfig<any, Request> = {
  type: TriggerType,
  args: {
    filter: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'AutomateTriggerFilterInputType',
          fields: {
            id: {
              type: GraphQLNonNull(UuidType),
            },
          },
        }),
      ),
    },
  },
  resolve: async (root, { filter }) => {
    return container.model.automateTriggerTable().where('id', filter.id).first();
  },
};

export const TriggerListQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(PaginateList('AutomateTriggerListQuery', GraphQLNonNull(TriggerType))),
  args: {
    filter: {
      type: new GraphQLInputObjectType({
        name: 'AutomateTriggerListFilterInputType',
        fields: {
          user: {
            type: UuidType,
          },
          wallet: {
            type: UuidType,
          },
          active: {
            type: GraphQLBoolean,
          },
          search: {
            type: GraphQLString,
          },
        },
      }),
      defaultValue: {},
    },
    sort: SortArgument(
      'AutomateTriggerListSortInputType',
      ['id', 'name', 'createdAt'],
      [{ column: 'name', order: 'asc' }],
    ),
    pagination: PaginationArgument('AutomateTriggerListPaginationInputType'),
  },
  resolve: async (root, { filter, sort, pagination }) => {
    const select = container.model
      .automateTriggerTable()
      .innerJoin(
        walletTableName,
        `${walletTableName}.id`,
        '=',
        `${Automate.triggerTableName}.wallet`,
      )
      .where(function () {
        const { active, search, wallet, user } = filter;
        if (typeof user === 'string') {
          this.andWhere(`${walletTableName}.user`, user);
        }
        if (typeof wallet === 'string') {
          this.andWhere(`${Automate.triggerTableName}.wallet`, wallet);
        }
        if (typeof active === 'boolean') {
          this.andWhere(`${Automate.triggerTableName}.active`, active);
        }
        if (typeof search === 'string' && search !== '') {
          this.andWhere(`${Automate.triggerTableName}.name`, 'iLike', `%${search}%`);
        }
      });

    return {
      list: await select
        .clone()
        .distinct(`${Automate.triggerTableName}.*`)
        .orderBy(sort)
        .limit(pagination.limit)
        .offset(pagination.offset),
      pagination: {
        count: await select.clone().countDistinct(`${Automate.triggerTableName}.id`).first(),
      },
    };
  },
};

export const TriggerCreateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(TriggerType),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'AutomateTriggerCreateInputType',
          fields: {
            wallet: {
              type: GraphQLNonNull(UuidType),
              description: 'Wallet owner',
            },
            type: {
              type: GraphQLNonNull(TriggerTypeEnum),
              description: 'Type',
            },
            name: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Name',
            },
            active: {
              type: GraphQLBoolean,
              description: 'Is active',
              defaultValue: true,
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('automateTrigger.create', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { wallet: walletId, type, name, active } = input;
    const wallet = await container.model.walletTable().where('id', walletId).first();
    if (!wallet) throw new UserInputError('Wallet not found');
    if (wallet.user !== currentUser.id) throw new UserInputError('Foreign wallet');

    const created = await container.model
      .automateService()
      .createTrigger(wallet, type, name, active);

    return created;
  }),
};

export const TriggerUpdateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(TriggerType),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'AutomateTriggerUpdateInputType',
          fields: {
            id: {
              type: GraphQLNonNull(UuidType),
              description: 'Trigger identifier',
            },
            name: {
              type: GraphQLString,
              description: 'Name',
            },
            active: {
              type: GraphQLBoolean,
              description: 'Is active',
              defaultValue: true,
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('automateTrigger.update', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { id, name, active } = input;
    const trigger = await container.model.automateTriggerTable().where('id', id).first();
    if (!trigger) throw new UserInputError('Trigger not found');

    const wallet = await container.model.walletTable().where('id', trigger.wallet).first();
    if (!wallet) throw new UserInputError('Wallet not found');
    if (wallet.user !== currentUser.id) throw new UserInputError('Foreign wallet');

    const updated = await container.model.automateService().updateTrigger({
      ...trigger,
      name: typeof name === 'string' ? name : trigger.name,
      active: typeof active === 'boolean' ? active : trigger.active,
    });

    return updated;
  }),
};

export const TriggerDeleteMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
  },
  resolve: onlyAllowed('automateTrigger.delete', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { id } = input;
    const trigger = await container.model.automateTriggerTable().where('id', id).first();
    if (!trigger) throw new UserInputError('Trigger not found');

    const wallet = await container.model.walletTable().where('id', trigger.wallet).first();
    if (!wallet) throw new UserInputError('Wallet not found');
    if (wallet.user !== currentUser.id) throw new UserInputError('Foreign wallet');

    await container.model.automateService().deleteTrigger(trigger);

    return true;
  }),
};

export const ConditionCreateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(ConditionType),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'AutomateConditionCreateInputType',
          fields: {
            trigger: {
              type: GraphQLNonNull(UuidType),
              description: 'Trigger',
            },
            type: {
              type: GraphQLNonNull(ConditionTypeEnum),
              description: 'Type',
            },
            params: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Parameters',
            },
            priority: {
              type: GraphQLInt,
              description: 'Execution priority (descending)',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('automateCondition.create', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { trigge: triggerId, type, params } = input;
    const trigger = await container.model.automateTriggerTable().where('id', triggerId).first();
    if (!trigger) throw new UserInputError('Trigger not found');

    const wallet = await container.model.walletTable().where('id', trigger.id).first();
    if (!wallet) throw new UserInputError('Wallet not found');
    if (wallet.user !== currentUser.id) throw new UserInputError('Foreign wallet');

    let { priority } = input;
    if (typeof priority !== 'number') {
      const conditionCountRow = await container.model
        .automateConditionTable()
        .where('trigger', trigger.id)
        .count()
        .first();
      priority = conditionCountRow?.count || 0;
    }

    const created = await container.model
      .automateService()
      .createCondition(trigger, type, JSON.parse(params), priority);

    return created;
  }),
};

export const ConditionUpdateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(ConditionType),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'AutomateConditionUpdateInputType',
          fields: {
            id: {
              type: GraphQLNonNull(UuidType),
              description: 'Condition identifier',
            },
            params: {
              type: GraphQLString,
              description: 'Parameters',
            },
            priority: {
              type: GraphQLInt,
              description: 'Execution priority (descending)',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('automateCondition.update', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { id, params, priority } = input;
    const condition = await container.model.automateConditionTable().where('id', id).first();
    if (!condition) throw new UserInputError('Condition not found');

    const trigger = await container.model
      .automateTriggerTable()
      .where('id', condition.trigger)
      .first();
    if (!trigger) throw new UserInputError('Trigger not found');

    const wallet = await container.model.walletTable().where('id', trigger.id).first();
    if (!wallet) throw new UserInputError('Wallet not found');
    if (wallet.user !== currentUser.id) throw new UserInputError('Foreign wallet');

    const updated = await container.model.automateService().updateCondition({
      ...condition,
      params: typeof params === 'string' ? JSON.parse(params) : condition.params,
      priority: typeof priority === 'number' ? priority : condition.priority,
    });

    return updated;
  }),
};

export const ConditionDeleteMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
  },
  resolve: onlyAllowed('automateCondition.delete', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { id } = input;
    const condition = await container.model.automateConditionTable().where('id', id).first();
    if (!condition) throw new UserInputError('Condition not found');

    const trigger = await container.model
      .automateTriggerTable()
      .where('id', condition.trigger)
      .first();
    if (!trigger) throw new UserInputError('Trigger not found');

    const wallet = await container.model.walletTable().where('id', trigger.id).first();
    if (!wallet) throw new UserInputError('Wallet not found');
    if (wallet.user !== currentUser.id) throw new UserInputError('Foreign wallet');

    await container.model.automateService().deleteCondition(condition);

    return true;
  }),
};

export const ActionCreateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(ActionType),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'AutomateActionCreateInputType',
          fields: {
            trigger: {
              type: GraphQLNonNull(UuidType),
              description: 'Trigger',
            },
            type: {
              type: GraphQLNonNull(ActionTypeEnum),
              description: 'Type',
            },
            params: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Parameters',
            },
            priority: {
              type: GraphQLInt,
              description: 'Execution priority (descending)',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('automateAction.create', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { trigge: triggerId, type, params } = input;
    const trigger = await container.model.automateTriggerTable().where('id', triggerId).first();
    if (!trigger) throw new UserInputError('Trigger not found');

    const wallet = await container.model.walletTable().where('id', trigger.id).first();
    if (!wallet) throw new UserInputError('Wallet not found');
    if (wallet.user !== currentUser.id) throw new UserInputError('Foreign wallet');

    let { priority } = input;
    if (typeof priority !== 'number') {
      const actionCountRow = await container.model
        .automateActionTable()
        .where('trigger', trigger.id)
        .count()
        .first();
      priority = actionCountRow?.count || 0;
    }

    const created = await container.model
      .automateService()
      .createAction(trigger, type, JSON.parse(params), priority);

    return created;
  }),
};

export const ActionUpdateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(ActionType),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'AutomateActionUpdateInputType',
          fields: {
            id: {
              type: GraphQLNonNull(UuidType),
              description: 'Action identifier',
            },
            params: {
              type: GraphQLString,
              description: 'Parameters',
            },
            priority: {
              type: GraphQLInt,
              description: 'Execution priority (descending)',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('automateAction.update', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { id, params, priority } = input;
    const action = await container.model.automateActionTable().where('id', id).first();
    if (!action) throw new UserInputError('Action not found');

    const trigger = await container.model
      .automateTriggerTable()
      .where('id', action.trigger)
      .first();
    if (!trigger) throw new UserInputError('Trigger not found');

    const wallet = await container.model.walletTable().where('id', trigger.id).first();
    if (!wallet) throw new UserInputError('Wallet not found');
    if (wallet.user !== currentUser.id) throw new UserInputError('Foreign wallet');

    const updated = await container.model.automateService().updateAction({
      ...action,
      params: typeof params === 'string' ? JSON.parse(params) : action.params,
      priority: typeof priority === 'number' ? priority : action.priority,
    });

    return updated;
  }),
};

export const ActionDeleteMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
  },
  resolve: onlyAllowed('automateAction.delete', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { id } = input;
    const action = await container.model.automateActionTable().where('id', id).first();
    if (!action) throw new UserInputError('Condition not found');

    const trigger = await container.model
      .automateTriggerTable()
      .where('id', action.trigger)
      .first();
    if (!trigger) throw new UserInputError('Trigger not found');

    const wallet = await container.model.walletTable().where('id', trigger.id).first();
    if (!wallet) throw new UserInputError('Wallet not found');
    if (wallet.user !== currentUser.id) throw new UserInputError('Foreign wallet');

    await container.model.automateService().deleteAction(action);

    return true;
  }),
};
