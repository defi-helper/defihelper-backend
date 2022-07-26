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
  Manually = 'manually',
  Scanner = 'scanner',
  Adapter = 'adapter',
}

export namespace PriceFeed {
  export interface CoingeckoId {
    type: 'coingeckoId';
    id: string;
  }

  export function isCoingeckoId(v: any): v is CoingeckoId {
    if (typeof v !== 'object' || v === null) return false;
    if (
      !Object.prototype.hasOwnProperty.call(v, 'type') ||
      !Object.prototype.hasOwnProperty.call(v, 'id')
    ) {
      return false;
    }
    if (v.type !== 'coingeckoId') return false;

    return true;
  }

  export enum CoingeckoPlatform {
    Ethereum = 'ethereum',
    BSC = 'binance-smart-chain',
    Avalanche = 'avalanche',
    Moonriver = 'moonriver',
    Polygon = 'polygon-pos',
    Fantom = 'fantom',
    Cronos = 'cronos',
    Arbitrum = 'arbitrum-one',
    Optimistic = 'optimistic-ethereum',
  }

  export interface CoingeckoAddress {
    type: 'coingeckoAddress';
    platform: CoingeckoPlatform;
    address: string;
  }

  export function isCoingeckoAddress(v: any): v is CoingeckoAddress {
    if (typeof v !== 'object' || v === null) return false;
    if (
      !Object.prototype.hasOwnProperty.call(v, 'type') ||
      !Object.prototype.hasOwnProperty.call(v, 'platform') ||
      !Object.prototype.hasOwnProperty.call(v, 'address')
    ) {
      return false;
    }
    if (v.type !== 'coingeckoAddress') return false;
    if (!Object.values(CoingeckoPlatform).includes(v.platform)) return false;

    return true;
  }

  export type PriceFeed = CoingeckoId | CoingeckoAddress;
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
  priceFeed: PriceFeed.PriceFeed | null;
  priceFeedNeeded: boolean;
  createdBy: TokenCreatedBy;
  updatedAt: Date;
  createdAt: Date;
}

export const tokenTableName = 'token';

export const tokenTableFactory = tableFactoryLegacy<Token>(tokenTableName);

export type TokenTable = ReturnType<ReturnType<typeof tokenTableFactory>>;

export interface TokenPart {
  id: string;
  parent: string;
  child: string;
  createdAt: Date;
}

export const tokenPartTableName = 'token_part';

export const tokenPartTableFactory = tableFactoryLegacy<TokenPart>(tokenPartTableName);

export type TokenPartTable = ReturnType<ReturnType<typeof tokenPartTableFactory>>;
