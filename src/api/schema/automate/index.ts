import * as Automate from '@models/Automate/Entity';
import { AuthenticationError, UserInputError } from 'apollo-server-express';
import BN from 'bignumber.js';
import { Request } from 'express';
import { Role } from '@models/User/Entity';
import container from '@container';
import {
  walletTableName,
  walletBlockchainTableName,
  WalletBlockchainType as WalletBlockchainModelType,
} from '@models/Wallet/Entity';
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
  GraphQLList,
  GraphQLFieldConfigMap,
  GraphQLFloat,
} from 'graphql';
import { apyBoost, optimalRestakeNearesDate } from '@services/RestakeStrategy';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';
import { metricContractTableName } from '@models/Metric/Entity';
import dayjs from 'dayjs';
import {
  BigNumberType,
  DateTimeType,
  EthereumAddressType,
  EthereumTransactionHashType,
  onlyAllowed,
  PaginateList,
  PaginationArgument,
  SortArgument,
  UuidType,
} from '../types';
import * as Actions from '../../../automate/action';
import * as Conditions from '../../../automate/condition';
import { WalletBlockchainType } from '../user';
import { ProtocolType, ContractType as ProtocolContractType } from '../protocol';
import { TokenType } from '../token';

export const ConditionTypeEnum = new GraphQLEnumType({
  name: 'AutomateConditionTypeEnum',
  values: Object.keys(Conditions).reduce(
    (res, handler) => ({ ...res, [handler]: { value: handler } }),
    {} as GraphQLEnumValueConfigMap,
  ),
});

export const ConditionType = new GraphQLObjectType<Automate.Condition, Request>({
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
    paramsDescription: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Stringify parameters',
      resolve: ({ type, params }, args, { i18n }) =>
        container.template.render(i18n.t(`automate:condition:${type}:paramsDescription`), params),
    },
    priority: {
      type: GraphQLNonNull(GraphQLInt),
      description: 'Execution priority (ascending)',
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

export const ActionType = new GraphQLObjectType<Automate.Action, Request>({
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
      description: 'Action parameters',
      resolve: ({ params }) => JSON.stringify(params),
    },
    paramsDescription: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Stringify parameters',
      resolve: ({ type, params }, args, { i18n }) =>
        container.template.render(i18n.t(`automate:action:${type}:paramsDescription`), params),
    },
    priority: {
      type: GraphQLNonNull(GraphQLInt),
      description: 'Execution priority (ascending)',
    },
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Created at date',
    },
  },
});

export const TriggerCallHistoryType = new GraphQLObjectType<Automate.TriggerCallHistory>({
  name: 'AutomateTriggerCallHistoryType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    error: {
      type: GraphQLString,
      description: 'Call error',
    },
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Created at date',
    },
  },
});

export const TriggerCallHistoryListQuery: GraphQLFieldConfig<Automate.Trigger, Request> = {
  type: GraphQLNonNull(
    PaginateList('AutomateTriggerCallHistoryListQuery', GraphQLNonNull(TriggerCallHistoryType)),
  ),
  args: {
    filter: {
      type: new GraphQLInputObjectType({
        name: 'AutomateTriggerCallHistoryListFilterInputType',
        fields: {
          hasError: {
            type: GraphQLBoolean,
          },
        },
      }),
      defaultValue: {},
    },
    sort: SortArgument(
      'AutomateTriggerCallHistoryListSortInputType',
      ['createdAt'],
      [{ column: 'createdAt', order: 'desc' }],
    ),
    pagination: PaginationArgument('AutomateTriggerCallHistoryListPaginationInputType'),
  },
  resolve: async (trigger, { filter, sort, pagination }) => {
    const select = container.model.automateTriggerCallHistoryTable().where(function () {
      this.where('trigger', trigger.id);
      const { hasError } = filter;
      if (typeof hasError === 'boolean') {
        if (hasError) {
          this.whereNotNull('error');
        } else {
          this.whereNull('error');
        }
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

export const TriggerTypeEnum = new GraphQLEnumType({
  name: 'AutomateTriggerTypeEnum',
  values: Object.values(Automate.TriggerType).reduce(
    (res, value) => ({ ...res, [value]: { value } }),
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
    params: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Trigger parameters',
      resolve: ({ params }) => JSON.stringify(params),
    },
    wallet: {
      type: GraphQLNonNull(WalletBlockchainType),
      description: 'Wallet of owner',
      resolve: ({ wallet }) => {
        return container.model
          .walletTable()
          .innerJoin(
            walletBlockchainTableName,
            `${walletBlockchainTableName}.id`,
            `${walletTableName}.id`,
          )
          .where(`${walletTableName}.id`, wallet)
          .first();
      },
    },
    name: {
      type: GraphQLNonNull(GraphQLString),
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
    callHistory: TriggerCallHistoryListQuery,
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
  resolve: async (root, { filter, sort, pagination }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const select = container.model
      .automateTriggerTable()
      .innerJoin(walletTableName, `${walletTableName}.id`, `${Automate.triggerTableName}.wallet`)
      .where(function () {
        const { active, search, wallet, user } = filter;
        if (typeof user === 'string' && currentUser.role === Role.Admin) {
          this.andWhere(`${walletTableName}.user`, user);
        } else {
          this.andWhere(`${walletTableName}.user`, currentUser.id);
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

export const DescriptionType = new GraphQLObjectType({
  name: 'AutomateDescriptionType',
  fields: {
    name: {
      type: GraphQLNonNull(GraphQLString),
    },
    description: {
      type: GraphQLNonNull(GraphQLString),
    },
  },
});

export const DescriptionQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(
    new GraphQLObjectType({
      name: 'AutomatesDescriptionType',
      fields: {
        triggers: {
          type: GraphQLNonNull(
            new GraphQLObjectType({
              name: 'AutomateTriggersDescriptionType',
              fields: Object.values(Automate.TriggerType).reduce(
                (res: GraphQLFieldConfigMap<any, Request>, value: string) => ({
                  ...res,
                  [value]: {
                    type: GraphQLNonNull(DescriptionType),
                    resolve: (root, args, { currentUser }) => {
                      const i18n = container.i18n.byUser(currentUser);
                      return {
                        name: i18n.t(`automate:trigger:${value}:name`),
                        description: i18n.t(`automate:trigger:${value}:description`),
                      };
                    },
                  },
                }),
                {},
              ),
            }),
          ),
          resolve: () => ({}),
        },
        conditions: {
          type: GraphQLNonNull(
            new GraphQLObjectType({
              name: 'AutomateConditionsDescriptionType',
              fields: Object.keys(Conditions).reduce(
                (res: GraphQLFieldConfigMap<any, Request>, value: string) => ({
                  ...res,
                  [value]: {
                    type: GraphQLNonNull(DescriptionType),
                    resolve: (root, args, { currentUser }) => {
                      const i18n = container.i18n.byUser(currentUser);
                      return {
                        name: i18n.t(`automate:condition:${value}:name`),
                        description: i18n.t(`automate:condition:${value}:description`),
                      };
                    },
                  },
                }),
                {},
              ),
            }),
          ),
          resolve: () => ({}),
        },
        actions: {
          type: GraphQLNonNull(
            new GraphQLObjectType({
              name: 'AutomateActionsDescriptionType',
              fields: Object.keys(Actions).reduce(
                (res: GraphQLFieldConfigMap<any, Request>, value: string) => ({
                  ...res,
                  [value]: {
                    type: GraphQLNonNull(DescriptionType),
                    resolve: (root, args, { currentUser }) => {
                      const i18n = container.i18n.byUser(currentUser);
                      return {
                        name: i18n.t(`automate:action:${value}:name`),
                        description: i18n.t(`automate:action:${value}:description`),
                      };
                    },
                  },
                }),
                {},
              ),
            }),
          ),
          resolve: () => ({}),
        },
      },
    }),
  ),
  resolve: () => ({}),
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
            params: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Parameters',
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

    const { wallet: walletId, type, params, name, active } = input;
    const wallet = await container.model.walletTable().where('id', walletId).first();
    if (!wallet) throw new UserInputError('Wallet not found');
    if (wallet.user !== currentUser.id) throw new UserInputError('Foreign wallet');

    const created = await container.model
      .automateService()
      .createTrigger(wallet, { type, params: JSON.parse(params) }, name, active);

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
  resolve: onlyAllowed('automateTrigger.update-own', async (root, { input }, { currentUser }) => {
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
  resolve: onlyAllowed('automateTrigger.delete-own', async (root, { id }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

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
              description: 'Execution priority (ascending)',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('automateCondition.create', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { trigger: triggerId, type, params } = input;
    const trigger = await container.model.automateTriggerTable().where('id', triggerId).first();
    if (!trigger) throw new UserInputError('Trigger not found');

    const wallet = await container.model.walletTable().where('id', trigger.wallet).first();
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

    const paramsObject = JSON.parse(params);
    try {
      Automate.conditionParamsVerify(type, paramsObject);
      const created = await container.model
        .automateService()
        .createCondition(trigger, type, paramsObject, priority);

      return created;
    } catch (e) {
      throw new UserInputError(`Invalid params: ${e instanceof Error ? e.message : e}`);
    }
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
              description: 'Execution priority (ascending)',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('automateCondition.update-own', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { id, params, priority } = input;
    const condition = await container.model.automateConditionTable().where('id', id).first();
    if (!condition) throw new UserInputError('Condition not found');

    const trigger = await container.model
      .automateTriggerTable()
      .where('id', condition.trigger)
      .first();
    if (!trigger) throw new UserInputError('Trigger not found');

    const wallet = await container.model.walletTable().where('id', trigger.wallet).first();
    if (!wallet) throw new UserInputError('Wallet not found');
    if (wallet.user !== currentUser.id) throw new UserInputError('Foreign wallet');

    const paramsObject = typeof params === 'string' ? JSON.parse(params) : condition.params;
    try {
      Automate.conditionParamsVerify(condition.type, paramsObject);
      const updated = await container.model.automateService().updateCondition({
        ...condition,
        params: paramsObject,
        priority: typeof priority === 'number' ? priority : condition.priority,
      });

      return updated;
    } catch (e) {
      throw new UserInputError(`Invalid params: ${e instanceof Error ? e.message : e}`);
    }
  }),
};

export const ConditionDeleteMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
  },
  resolve: onlyAllowed('automateCondition.delete-own', async (root, { id }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const condition = await container.model.automateConditionTable().where('id', id).first();
    if (!condition) throw new UserInputError('Condition not found');

    const trigger = await container.model
      .automateTriggerTable()
      .where('id', condition.trigger)
      .first();
    if (!trigger) throw new UserInputError('Trigger not found');

    const wallet = await container.model.walletTable().where('id', trigger.wallet).first();
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
              description: 'Execution priority (ascending)',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('automateAction.create', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { trigger: triggerId, type, params } = input;
    const trigger = await container.model.automateTriggerTable().where('id', triggerId).first();
    if (!trigger) throw new UserInputError('Trigger not found');

    const wallet = await container.model.walletTable().where('id', trigger.wallet).first();
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

    const paramsObject = JSON.parse(params);
    try {
      Automate.actionParamsVerify(type, paramsObject);
      const created = await container.model
        .automateService()
        .createAction(trigger, type, paramsObject, priority);

      return created;
    } catch (e) {
      throw new UserInputError(`Invalid params: ${e instanceof Error ? e.message : e}`);
    }
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
              description: 'Execution priority (ascending)',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('automateAction.update-own', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { id, params, priority } = input;
    const action = await container.model.automateActionTable().where('id', id).first();
    if (!action) throw new UserInputError('Action not found');

    const trigger = await container.model
      .automateTriggerTable()
      .where('id', action.trigger)
      .first();
    if (!trigger) throw new UserInputError('Trigger not found');

    const wallet = await container.model.walletTable().where('id', trigger.wallet).first();
    if (!wallet) throw new UserInputError('Wallet not found');
    if (wallet.user !== currentUser.id) throw new UserInputError('Foreign wallet');

    const paramsObject = typeof params === 'string' ? JSON.parse(params) : action.params;
    try {
      Automate.actionParamsVerify(action.type, paramsObject);

      const updated = await container.model.automateService().updateAction({
        ...action,
        params: paramsObject,
        priority: typeof priority === 'number' ? priority : action.priority,
      });

      return updated;
    } catch (e) {
      throw new UserInputError(`Invalid params: ${e instanceof Error ? e.message : e}`);
    }
  }),
};

export const ActionDeleteMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
  },
  resolve: onlyAllowed('automateAction.delete-own', async (root, { id }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const action = await container.model.automateActionTable().where('id', id).first();
    if (!action) throw new UserInputError('Condition not found');

    const trigger = await container.model
      .automateTriggerTable()
      .where('id', action.trigger)
      .first();
    if (!trigger) throw new UserInputError('Trigger not found');

    const wallet = await container.model.walletTable().where('id', trigger.wallet).first();
    if (!wallet) throw new UserInputError('Wallet not found');
    if (wallet.user !== currentUser.id) throw new UserInputError('Foreign wallet');

    await container.model.automateService().deleteAction(action);

    return true;
  }),
};

export const ContractStopLossStatusEnum = new GraphQLEnumType({
  name: 'AutomateContractStopLossStatusEnum',
  values: Object.values(Automate.ContractStopLossStatus).reduce(
    (res, value) => ({ ...res, [value]: { value } }),
    {} as GraphQLEnumValueConfigMap,
  ),
});

export const ContractStopLossType = new GraphQLObjectType<Automate.ContractStopLoss, Request>({
  name: 'AutomateContractStopLossType',
  fields: {
    status: {
      type: GraphQLNonNull(ContractStopLossStatusEnum),
    },
    tx: {
      type: GraphQLNonNull(EthereumTransactionHashType),
    },
    amountOut: {
      type: BigNumberType,
    },
    inToken: {
      type: TokenType,
      resolve: ({ stopLoss: { inToken } }, args, { dataLoader }) => {
        if (inToken === null) return null;
        return dataLoader.token().load(inToken);
      },
    },
    outToken: {
      type: TokenType,
      resolve: ({ stopLoss: { outToken } }, args, { dataLoader }) => {
        if (outToken === null) return null;
        return dataLoader.token().load(outToken);
      },
    },
    params: {
      type: GraphQLNonNull(
        new GraphQLObjectType<Automate.ContractStopLoss['stopLoss']>({
          name: 'AutomateContractStopLossParamsType',
          fields: {
            path: {
              type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLString))),
            },
            amountOut: {
              type: GraphQLNonNull(BigNumberType),
            },
            amountOutMin: {
              type: GraphQLNonNull(BigNumberType),
            },
            slippage: {
              type: GraphQLNonNull(GraphQLFloat),
              resolve: ({ amountOut, amountOutMin }) => {
                return new BN(amountOut).minus(amountOutMin).div(amountOut).toString(10);
              },
            },
          },
        }),
      ),
      resolve: ({ stopLoss }) => stopLoss,
    },
  },
});

export const ContractVerificationStatusEnum = new GraphQLEnumType({
  name: 'AutomateContractVerificationStatusEnum',
  values: Object.values(Automate.ContractVerificationStatus).reduce(
    (res, value) => ({ ...res, [value]: { value } }),
    {} as GraphQLEnumValueConfigMap,
  ),
});

export const ContractTypeEnum = new GraphQLEnumType({
  name: 'AutomateContractTypeEnum',
  values: Object.values(Automate.ContractType).reduce(
    (res, value) => ({ ...res, [value]: { value } }),
    {} as GraphQLEnumValueConfigMap,
  ),
});

export const ContractMetricType = new GraphQLObjectType({
  name: 'AutomateContractMetricType',
  fields: {
    invest: {
      type: GraphQLNonNull(GraphQLString),
    },
    staked: {
      type: GraphQLNonNull(GraphQLString),
    },
    earned: {
      type: GraphQLNonNull(GraphQLString),
    },
    apyBoost: {
      type: GraphQLNonNull(GraphQLString),
      resolve: ({ apyBoost: { blockchain, network, balance, aprYear } }) => {
        return apyBoost(blockchain, network, balance, aprYear);
      },
    },
  },
});

export const ContractType = new GraphQLObjectType<Automate.Contract, Request>({
  name: 'AutomateContractType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    type: {
      type: GraphQLNonNull(ContractTypeEnum),
      description: 'Contract type',
    },
    wallet: {
      type: GraphQLNonNull(WalletBlockchainType),
      description: 'Owner wallet',
      resolve: (contract, args, { dataLoader }) => {
        return dataLoader.wallet().load(contract.wallet);
      },
    },
    protocol: {
      type: GraphQLNonNull(ProtocolType),
      description: 'Protocol',
      resolve: (contract) => {
        return container.model.protocolTable().where('id', contract.protocol).first();
      },
    },
    contract: {
      type: ProtocolContractType,
      description: 'Protocol contract',
      resolve: (contract, args, { dataLoader }) => {
        if (!contract.contract) return null;

        return dataLoader.contract().load(contract.contract);
      },
    },
    address: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Address in blockchain',
    },
    contractWallet: {
      type: WalletBlockchainType,
      description: 'Automate contract wallet',
      resolve: async (contract, args, { dataLoader }) => {
        if (contract.verification !== Automate.ContractVerificationStatus.Confirmed) return null;

        const ownerWallet = await dataLoader.wallet().load(contract.wallet);
        if (!ownerWallet) return null;

        return container.model
          .walletTable()
          .innerJoin(
            walletBlockchainTableName,
            `${walletBlockchainTableName}.id`,
            `${walletTableName}.id`,
          )
          .where({
            user: ownerWallet.user,
            type: WalletBlockchainModelType.Contract,
            address:
              ownerWallet.blockchain === 'ethereum'
                ? contract.address.toLowerCase()
                : contract.address,
          })
          .first();
      },
    },
    adapter: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Adapter name',
    },
    initParams: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Init method parameters',
      resolve: ({ initParams }) => JSON.stringify(initParams),
    },
    verification: {
      type: GraphQLNonNull(ContractVerificationStatusEnum),
      description: 'Verification status',
    },
    rejectReason: {
      type: GraphQLNonNull(GraphQLString),
    },
    restakeAt: {
      type: DateTimeType,
      description: 'restake at',
      resolve: async (contract, _, { dataLoader, currentUser }) => {
        if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');
        const cache = container.cache();

        if (contract.type !== Automate.ContractType.Autorestake) {
          return null;
        }

        if (
          !contract.contract ||
          contract.verification !== Automate.ContractVerificationStatus.Confirmed
        ) {
          return null;
        }

        const cachedState = await cache.promises
          .get(`defihelper:automate:nextRestake:${contract.id}`)
          .catch(() => null);
        if (cachedState) {
          return dayjs(cachedState);
        }

        const stakingContract = await dataLoader.contract().load(contract.contract);
        if (!stakingContract) return null;

        const { apr } = (await container.model
          .metricContractTable()
          .column(
            container
              .database()
              .raw(`(${metricContractTableName}.data->>'aprYear')::numeric AS apr`),
          )
          .where('contract', stakingContract.id)
          .orderBy(`${metricContractTableName}.date`, 'DESC')
          .first()) as unknown as { apr?: number };

        if (!apr) return null;

        const walletMetric = await dataLoader
          .contractUserMetric({
            userId: currentUser.id,
            walletType: [WalletBlockchainModelType.Contract, WalletBlockchainModelType.Wallet],
          })
          .load(contract.contract);

        const nextRestakeDate = await optimalRestakeNearesDate(
          stakingContract.blockchain,
          stakingContract.network,
          new BN(walletMetric.stakingUSD).toNumber(),
          new BN(walletMetric.earnedUSD).toNumber(),
          new BN(apr).toNumber(),
        );
        if (nextRestakeDate) {
          await cache.promises.setex(
            `defihelper:automate:nextRestake:${contract.id}`,
            300,
            nextRestakeDate.toISOString(),
          );
        }

        return nextRestakeDate;
      },
    },
    metric: {
      type: GraphQLNonNull(ContractMetricType),
      resolve: async (contract, args, { dataLoader }) => {
        const def = {
          staked: '0',
          earned: '0',
          apyBoost: '0',
        };
        if (
          !contract.contract ||
          contract.verification !== Automate.ContractVerificationStatus.Confirmed
        )
          return def;

        const staking = await dataLoader.contract().load(contract.contract);
        if (!staking) return def;
        const ownerWallet = await dataLoader.wallet().load(contract.wallet);
        if (!ownerWallet) return def;
        const wallet = await container.model
          .walletTable()
          .innerJoin(
            walletBlockchainTableName,
            `${walletBlockchainTableName}.id`,
            `${walletTableName}.id`,
          )
          .where({
            user: ownerWallet.user,
            type: WalletBlockchainModelType.Contract,
            address:
              ownerWallet.blockchain === 'ethereum'
                ? contract.address.toLowerCase()
                : contract.address,
          })
          .first();
        if (!wallet) return def;

        const walletMetric = await dataLoader.walletMetric().load(wallet.id);
        const totalBalance = new BN(walletMetric.stakingUSD)
          .plus(walletMetric.earnedUSD)
          .toNumber();
        const invest = await dataLoader.automateInvestHistory().load(contract.id);
        return {
          invest: invest.amountUSD,
          staked: walletMetric.stakingUSD,
          earned: walletMetric.earnedUSD,
          apyBoost: {
            blockchain: staking.blockchain,
            network: staking.network,
            balance: totalBalance > 0 ? totalBalance : 10000,
            aprYear: new BN(staking.metric.aprYear ?? '0').toNumber(),
          },
        };
      },
    },
    archivedAt: {
      type: DateTimeType,
      description: 'Date at archived contract',
    },
    stopLoss: {
      type: ContractStopLossType,
      resolve: (contract, args, { dataLoader }) => {
        return dataLoader.automateContractStopLoss().load(contract.id);
      },
    },
    trigger: {
      type: TriggerType,
      resolve: (contract, args, { dataLoader }) => {
        return dataLoader.automateContractTrigger().load(contract.id);
      },
    },
  },
});

export const ContractListQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(PaginateList('AutomateContractListQuery', GraphQLNonNull(ContractType))),
  args: {
    filter: {
      type: new GraphQLInputObjectType({
        name: 'AutomateContractListFilterInputType',
        fields: {
          user: {
            type: UuidType,
          },
          wallet: {
            type: UuidType,
            description: 'Owner wallet',
          },
          protocol: {
            type: UuidType,
          },
          contract: {
            type: GraphQLList(GraphQLNonNull(UuidType)),
          },
          type: {
            type: GraphQLList(GraphQLNonNull(ContractTypeEnum)),
          },
          address: {
            type: GraphQLList(GraphQLNonNull(GraphQLString)),
          },
          archived: {
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
      'AutomateContractListSortInputType',
      ['createdAt'],
      [{ column: 'createdAt', order: 'asc' }],
    ),
    pagination: PaginationArgument('AutomateContractListPaginationInputType'),
  },
  resolve: async (root, { filter, sort, pagination }) => {
    const select = container.model
      .automateContractTable()
      .innerJoin(walletTableName, `${walletTableName}.id`, `${Automate.contractTableName}.wallet`)
      .leftJoin(
        contractTableName,
        `${contractTableName}.id`,
        `${Automate.contractTableName}.contract`,
      )
      .where(function () {
        const { wallet, user, protocol, contract, type, address, archived, search } = filter;
        if (typeof user === 'string') {
          this.andWhere(`${walletTableName}.user`, user);
        }
        if (typeof wallet === 'string') {
          this.andWhere(`${Automate.contractTableName}.wallet`, wallet);
        }
        if (typeof protocol === 'string') {
          this.andWhere(`${Automate.contractTableName}.protocol`, protocol);
        }
        if (Array.isArray(type)) {
          this.whereIn(`${Automate.contractTableName}.type`, type);
        }
        if (Array.isArray(contract) && contract.length > 0) {
          this.whereIn(`${Automate.contractTableName}.contract`, contract);
        }
        if (Array.isArray(address) && address.length > 0) {
          this.whereIn(`${Automate.contractTableName}.address`, address);
        }
        if (typeof archived === 'boolean') {
          if (archived) this.whereNotNull(`${Automate.contractTableName}.archivedAt`);
          else this.whereNull(`${Automate.contractTableName}.archivedAt`);
        }
        if (typeof search === 'string' && search !== '') {
          this.where(`${contractTableName}.name`, 'iLike', `%${search}%`);
        }
      });

    return {
      list: await select
        .clone()
        .distinct(`${Automate.contractTableName}.*`)
        .orderBy(sort)
        .limit(pagination.limit)
        .offset(pagination.offset),
      pagination: {
        count: await select.clone().countDistinct(`${Automate.contractTableName}.id`).first(),
      },
    };
  },
};

export const ContractCreateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(ContractType),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'AutomateContractCreateInputType',
          fields: {
            wallet: {
              type: GraphQLNonNull(UuidType),
              description: 'Wallet owner',
            },
            protocol: {
              type: GraphQLNonNull(UuidType),
              description: 'Protocol',
            },
            contract: {
              type: UuidType,
              description: 'Protocol contract',
            },
            type: {
              type: GraphQLNonNull(ContractTypeEnum),
            },
            address: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Address',
            },
            adapter: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Adapter name',
            },
            initParams: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Init method parameters',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('automateContract.create', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const {
      wallet: walletId,
      protocol: protocolId,
      contract: contractId,
      type,
      address,
      adapter,
      initParams,
    } = input;
    const blockchainWallet = await container.model
      .walletTable()
      .innerJoin(
        walletBlockchainTableName,
        `${walletBlockchainTableName}.id`,
        `${walletTableName}.id`,
      )
      .where(`${walletTableName}.id`, walletId)
      .first();
    if (!blockchainWallet) throw new UserInputError('Wallet not found');
    if (blockchainWallet.user !== currentUser.id) throw new UserInputError('Foreign wallet');

    const protocol = await container.model.protocolTable().where('id', protocolId).first();
    if (!protocol) throw new UserInputError('Protocol not found');

    const contract = contractId
      ? await container.model
          .contractTable()
          .innerJoin(
            contractBlockchainTableName,
            `${contractBlockchainTableName}.id`,
            `${contractTableName}.id`,
          )
          .where(`${contractTableName}.id`, contractId)
          .first()
      : null;
    if (contract === undefined) throw new UserInputError('Protocol contract not found');
    if (contract !== null) {
      if (contract.protocol !== protocol.id) {
        throw new UserInputError('Invalid protocol contract');
      }
      if (blockchainWallet.blockchain !== contract.blockchain) {
        throw new UserInputError('Invalid blockchain');
      }
      if (blockchainWallet.network !== contract.network) {
        throw new UserInputError('Invalid network');
      }
    }

    const created = await container.model
      .automateService()
      .createContract(
        type,
        blockchainWallet,
        protocol,
        contract,
        address,
        adapter,
        JSON.parse(initParams),
      );

    return created;
  }),
};

export const ContractUpdateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(ContractType),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'AutomateContractUpdateInputType',
          fields: {
            id: {
              type: GraphQLNonNull(UuidType),
              description: 'Contract identifier',
            },
            initParams: {
              type: GraphQLString,
              description: 'Init method parameters',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('automateContract.update-own', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { id, initParams } = input;
    const contract = await container.model.automateContractTable().where('id', id).first();
    if (!contract) throw new UserInputError('Contract not found');

    const wallet = await container.model.walletTable().where('id', contract.wallet).first();
    if (!wallet) throw new UserInputError('Wallet not found');
    if (wallet.user !== currentUser.id) throw new UserInputError('Foreign wallet');

    const updated = await container.model.automateService().updateContract({
      ...contract,
      initParams: typeof initParams === 'string' ? JSON.parse(initParams) : contract.initParams,
    });

    return updated;
  }),
};

export const ContractDeleteMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
  },
  resolve: onlyAllowed('automateContract.delete-own', async (root, { id }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const contract = await container.model.automateContractTable().where('id', id).first();
    if (!contract) throw new UserInputError('Contract not found');

    const wallet = await container.model.walletTable().where('id', contract.wallet).first();
    if (!wallet) throw new UserInputError('Wallet not found');
    if (wallet.user !== currentUser.id) throw new UserInputError('Foreign wallet');

    await container.model.automateService().updateContract({
      ...contract,
      archivedAt: new Date(),
    });

    const automateService = container.model.automateService();
    await container.model
      .automateTriggerTable()
      .whereIn(
        'id',
        container.model
          .automateActionTable()
          .column('trigger')
          .where('type', 'ethereumAutomateRun')
          .whereRaw("params->>'id' = ?", [contract.id]),
      )
      .then((triggers) =>
        Promise.all(triggers.map((trigger) => automateService.deleteTrigger(trigger))),
      );

    return true;
  }),
};

export const ContractTriggerUpdateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLList(GraphQLNonNull(TriggerType))),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'AutomateContractTriggerUpdateInputType',
          fields: {
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
  resolve: onlyAllowed(
    'automateTrigger.update-own',
    async (root, { id, input }, { currentUser }) => {
      if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

      const contract = await container.model.automateContractTable().where('id', id).first();
      if (!contract) throw new UserInputError('Contract not found');

      const triggers = await container.model
        .automateTriggerTable()
        .distinct(`${Automate.triggerTableName}.*`)
        .innerJoin(
          Automate.actionTableName,
          `${Automate.triggerTableName}.id`,
          `${Automate.actionTableName}.trigger`,
        )
        .where(`${Automate.actionTableName}.type`, 'ethereumAutomateRun')
        .where(
          container.database().raw(`${Automate.actionTableName}.params->>'id' = ?`, [contract.id]),
        )
        .then((v) => v as Automate.Trigger[]);
      const walletsMap = await container.model
        .walletTable()
        .whereIn(
          'id',
          triggers.map(({ wallet }: { wallet: string }) => wallet),
        )
        .then((rows) => new Map(rows.map((wallet) => [wallet.id, wallet])));

      return triggers.reduce<Promise<Automate.Trigger[]>>(async (prev, trigger) => {
        const res = await prev;

        const wallet = walletsMap.get(trigger.wallet);
        if (!wallet || wallet.user !== currentUser.id) return res;

        return [
          ...res,
          await container.model.automateService().updateTrigger({
            ...trigger,
            active: typeof input.active === 'boolean' ? input.active : trigger.active,
          }),
        ];
      }, Promise.resolve([]));
    },
  ),
};

export const ContractStopLossEnable: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'AutomateContractStopLossEnableInputType',
          fields: {
            contract: {
              type: GraphQLNonNull(UuidType),
              description: 'Automate contract',
            },
            path: {
              type: GraphQLNonNull(GraphQLList(GraphQLNonNull(EthereumAddressType))),
              description: 'Swap path',
            },
            amountOut: {
              type: GraphQLNonNull(BigNumberType),
              description: 'Target amount',
            },
            amountOutMin: {
              type: GraphQLNonNull(BigNumberType),
              description: 'Amount out min',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('automateContract.create', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const contract = await container.model
      .automateContractTable()
      .where('id', input.contract)
      .first();
    if (!contract) {
      throw new UserInputError('Contract not found');
    }

    await container.model
      .automateService()
      .enableStopLoss(
        contract,
        input.path,
        input.amountOut.toFixed(0),
        input.amountOutMin.toFixed(0),
      );

    return true;
  }),
};

export const ContractStopLossDisable: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'AutomateContractStopLossDisableInputType',
          fields: {
            contract: {
              type: GraphQLNonNull(UuidType),
              description: 'Automate contract',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('automateContract.create', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const contract = await container.model
      .automateContractTable()
      .where('id', input.contract)
      .first();
    if (!contract) {
      throw new UserInputError('Contract not found');
    }

    await container.model.automateService().disableStopLoss(contract);

    return true;
  }),
};

export const InvestHistoryType = new GraphQLObjectType({
  name: 'AutomateInvestHistoryType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    amount: {
      type: GraphQLNonNull(BigNumberType),
    },
    amountUSD: {
      type: GraphQLNonNull(BigNumberType),
    },
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
    },
  },
});

export const InvestCreateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(InvestHistoryType),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'AutomateInvestCreateInputType',
          fields: {
            contract: {
              type: GraphQLNonNull(UuidType),
              description: 'Automate contract',
            },
            wallet: {
              type: GraphQLNonNull(UuidType),
              description: 'Investor wallet',
            },
            amount: {
              type: GraphQLNonNull(BigNumberType),
            },
            amountUSD: {
              type: GraphQLNonNull(BigNumberType),
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('automateInvestHistory.create', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const contract = await container.model
      .automateContractTable()
      .where('id', input.contract)
      .first();
    if (!contract) {
      throw new UserInputError('Contract not found');
    }
    const ownerWallet = await container.model.walletTable().where('id', contract.wallet).first();
    if (!ownerWallet) {
      throw new UserInputError('Owner wallet not found');
    }
    if (ownerWallet.user !== currentUser.id) {
      throw new UserInputError('Foreign owner wallet');
    }

    const wallet = await container.model.walletTable().where('id', input.wallet).first();
    if (!wallet) {
      throw new UserInputError('Wallet not found');
    }
    if (wallet.user !== currentUser.id) {
      throw new UserInputError('Foreign wallet');
    }

    return container.model
      .automateService()
      .createInvestHistory(contract, wallet, input.amount, input.amountUSD);
  }),
};

export const InvestRefundMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'AutomateInvestRefundInputType',
          fields: {
            contract: {
              type: GraphQLNonNull(UuidType),
              description: 'Automate contract',
            },
            wallet: {
              type: GraphQLNonNull(UuidType),
              description: 'Investor wallet',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('automateInvestHistory.refund', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const contract = await container.model
      .automateContractTable()
      .where('id', input.contract)
      .first();
    if (!contract) {
      throw new UserInputError('Contract not found');
    }
    const ownerWallet = await container.model.walletTable().where('id', contract.wallet).first();
    if (!ownerWallet) {
      throw new UserInputError('Owner wallet not found');
    }
    if (ownerWallet.user !== currentUser.id) {
      throw new UserInputError('Foreign owner wallet');
    }

    const wallet = await container.model.walletTable().where('id', input.wallet).first();
    if (!wallet) {
      throw new UserInputError('Wallet not found');
    }
    if (wallet.user !== currentUser.id) {
      throw new UserInputError('Foreign wallet');
    }

    await container.model.automateService().refundInvestHistory(contract, wallet);

    return true;
  }),
};
