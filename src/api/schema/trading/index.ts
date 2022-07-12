import container from '@container';
import { LoginResponse } from '@services/WhatToFarm';
import axios, { AxiosError } from 'axios';
import dayjs from 'dayjs';
import { Request } from 'express';
import { GraphQLFieldConfig, GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql';
import { DateTimeType } from '../types';

export const TradingAuthType = new GraphQLObjectType<any, Request>({
  name: 'TradingAuthType',
  fields: {
    accessToken: {
      type: GraphQLNonNull(GraphQLString),
    },
    refreshToken: {
      type: GraphQLNonNull(GraphQLString),
    },
    tokenExpired: {
      type: GraphQLNonNull(DateTimeType),
    },
  },
});

export const TradingAuthMutation: GraphQLFieldConfig<any, Request> = {
  type: TradingAuthType,
  resolve: async () => {
    const { email, username, password } = container.parent.whattofarm;
    const resp: LoginResponse | AxiosError = await container
      .whattofarm()
      .login(email, username, password)
      .catch((e) => e);
    if (axios.isAxiosError(resp)) return null;

    return {
      accessToken: resp.data.access_token,
      refreshToken: resp.data.refresh_token,
      tokenExpired: dayjs(resp.data.tokenExpired),
    };
  },
};
