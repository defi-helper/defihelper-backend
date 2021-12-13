import { tableFactory as createTableFactory } from '@services/Database';
import { Blockchain } from '@models/types';

export enum TokenAliasLiquidity {
  Stable = 'stable',
  Unstable = 'unstable',
  Trash = 'trash',
}

export interface TokenAlias {
  id: string;
  name: string;
  symbol: string;
  liquidity: TokenAliasLiquidity;
  logoUrl: string | null;
  protocol: string | null;
  updatedAt: Date;
  createdAt: Date;
}

export const tokenAliasTableName = 'token_alias';

export const tokenAliasTableFactory = createTableFactory<TokenAlias>(tokenAliasTableName);

export type TokenAliasTable = ReturnType<ReturnType<typeof tokenAliasTableFactory>>;

export interface Token {
  id: string;
  alias: string | null;
  blockchain: Blockchain;
  network: string;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  updatedAt: Date;
  createdAt: Date;
}

export const tokenTableName = 'token';

export const tokenTableFactory = createTableFactory<Token>(tokenTableName);

export type TokenTable = ReturnType<ReturnType<typeof tokenTableFactory>>;
