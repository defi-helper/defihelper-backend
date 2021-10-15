import container from '@container';
import axios from 'axios';
import { Request } from 'express';
import {
  GraphQLFieldConfig,
  GraphQLFloat,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from 'graphql';

function range(start: number, end: number) {
  return Array.from(new Array(end).keys()).slice(start);
}

function calcAssets(balance: number, earned: number, apd: number, fee: number, period: number) {
  return balance + earned + balance * apd * period - fee;
}

function calcRestakeEveryDay(
  balance: number,
  earned: number,
  apd: number,
  fee: number,
  period: number,
) {
  const apd1 = 1 + apd;
  return (
    balance * apd1 ** period + earned * apd1 ** (period - 1) - (fee * (apd1 ** period - 1)) / apd
  );
}

function calcRestakeOptimal(
  balance: number,
  earned: number,
  apd: number,
  fee: number,
  n_days: number,
  restake_days: number[],
) {
  const res = [];
  let cBalance = balance;
  let cEarned = earned;
  let prevTick = 0;

  const ticks = range(0, n_days + 1).concat(restake_days);
  ticks.sort((a, b) => a - b);

  // eslint-disable-next-line no-restricted-syntax
  for (const tick of ticks) {
    cEarned += cBalance * apd * (tick - prevTick);
    if (restake_days.includes(tick)) {
      cBalance += cEarned - fee;
      cEarned = 0;
    }
    res.push({ t: tick, v: cBalance + cEarned });
    prevTick = tick;
  }

  return res;
}

export interface Point {
  t: number;
  v: number;
}

export const PointType = new GraphQLObjectType<Point>({
  name: 'RestakeStrategyPointType',
  fields: {
    v: {
      type: GraphQLNonNull(GraphQLFloat),
    },
    t: {
      type: GraphQLNonNull(GraphQLFloat),
    },
  },
});

export const RestakeStrategyType = new GraphQLObjectType({
  name: 'RestakeStrategyType',
  fields: {
    hold: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(PointType))),
    },
    everyDay: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(PointType))),
    },
    optimal: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(PointType))),
    },
  },
});

export const RestakeStrategyQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(RestakeStrategyType),
  args: {
    balance: {
      type: GraphQLNonNull(GraphQLFloat),
    },
    apy: {
      type: GraphQLNonNull(GraphQLFloat),
    },
  },
  resolve: async (root, { balance, apy }) => {
    const apd = apy / 365;
    const fee = 0.5;
    const seq = 365;

    const holdPoints = range(1, seq + 1).reduce(
      (prev: Point[], period) => {
        return [...prev, { t: period, v: calcAssets(balance, 0, apd, 0, period) }];
      },
      [{ t: 0, v: balance }],
    );
    const everyDayPoints = range(1, seq + 1).reduce(
      (prev: Point[], period) => {
        return [...prev, { t: period, v: calcRestakeEveryDay(balance, 0, apd, fee, period) }];
      },
      [{ t: 0, v: balance }],
    );
    const { data: optimalRes } = await axios.get(
      `${container.parent.restakeOptimal.host}/optimal-seq`,
      {
        params: {
          balance,
          earned: 0,
          apd,
          fee,
          seq,
        },
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
    const optimalPoints = calcRestakeOptimal(balance, 0, apd, fee, 365, optimalRes);

    return {
      hold: range(0, 13).map((k) => holdPoints[k * 30]),
      everyDay: range(0, 13).map((k) => everyDayPoints[k * 30]),
      optimal: range(0, 13).map((k) => optimalPoints[k * 30]),
    };
  },
};
