import { tableFactoryLegacy } from '@services/Database';
import { Blockchain } from '@models/types';

export enum TokenAliasLiquidity {
  Stable = 'stable',
  Unstable = 'unstable',
  Trash = 'trash',
  Unknown = 'unknown',
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

export const tokenAliasTableFactory = tableFactoryLegacy<TokenAlias>(tokenAliasTableName);

export type TokenAliasTable = ReturnType<ReturnType<typeof tokenAliasTableFactory>>;

export enum TokenCreatedBy {
  Manualy = 'manualy',
  Scanner = 'scanner',
  Adapter = 'adapter',
}

export interface Token {
  id: string;
  alias: string | null;
  blockchain: Blockchain;
  network: string;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  tradable: boolean;
  createdBy: TokenCreatedBy;
  updatedAt: Date;
  createdAt: Date;
}

export const tokenTableName = 'token';

export const tokenTableFactory = tableFactoryLegacy<Token>(tokenTableName);

export type TokenTable = ReturnType<ReturnType<typeof tokenTableFactory>>;
