import { Config as EthereumConfig } from '@services/Blockchain/Ethereum';
import dotenv from 'dotenv';
import Moralis from 'moralis/node';

dotenv.config();

function int(value: string): number {
  return parseInt(value, 10);
}

function array(value: string): string[] {
  return JSON.parse(value);
}

export default {
  api: {
    port: int(process.env.API_PORT ?? '9000'),
    externalUrl: process.env.API_EXTERNAL_URL ?? 'https://backend-local.defihelper.io',
    internalUrl: process.env.API_INTERNAL_URL ?? 'https://backend-local.defihelper.io',
    secret: process.env.API_SECRET ?? 'defiHelperApiSecret',
  },
  scanner: {
    host: process.env.SCANNER_HOST ?? 'https://scanner-local.defihelper.io',
  },
  socilaStats: {
    host: process.env.SOCIAL_STATS_HOST ?? 'https://social-stats.defihelper.io',
  },
  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: int(process.env.DATABASE_PORT ?? '5432'),
    user: process.env.DATABASE_USER ?? '',
    password: process.env.DATABASE_PASSWORD ?? '',
    database: process.env.DATABASE_NAME ?? '',
  },
  cache: {
    host: process.env.CACHE_HOST ?? '127.0.0.1',
    port: int(process.env.CACHE_PORT ?? '6379'),
    password: process.env.CACHE_PASSWORD ?? undefined,
    database: process.env.CACHE_DATABASE ?? undefined,
  },
  blockchain: {
    ethereum: {
      // Main
      eth: {
        node: array(process.env.ETH_NODE ?? '[]'),
        historicalNode: array(process.env.ETH_NODE_HISTORICAL ?? '[]'),
        inspectors: array(process.env.ETH_INSPECTORS ?? '[]'),
        consumers: array(process.env.ETH_CONSUMERS ?? '[]'),
        avgBlockTime: 13.2,
      },
      // Ropsten
      ethRopsten: {
        node: array(process.env.ETH_ROPSTEN_NODE ?? '[]'),
        historicalNode: array(process.env.ETH_ROPSTEN_NODE_HISTORICAL ?? '[]'),
        inspectors: array(process.env.ETH_ROPSTEN_INSPECTORS ?? '[]'),
        consumers: array(process.env.ETH_ROPSTEN_CONSUMERS ?? '[]'),
        avgBlockTime: 13.2,
      },
      // BSC
      bsc: {
        node: array(process.env.BSC_NODE ?? '[]'),
        historicalNode: array(process.env.BSC_NODE_HISTORICAL ?? '[]'),
        inspectors: array(process.env.BSC_INSPECTORS ?? '[]'),
        consumers: array(process.env.BSC_CONSUMERS ?? '[]'),
        avgBlockTime: 3,
      },
      // Polygon
      polygon: {
        node: array(process.env.POLYGON_NODE ?? '[]'),
        historicalNode: array(process.env.POLYGON_NODE_HISTORICAL ?? '[]'),
        inspectors: array(process.env.POLYGON_INSPECTORS ?? '[]'),
        consumers: array(process.env.POLYGON_CONSUMERS ?? '[]'),
        avgBlockTime: 2.5,
      },
      // Avalanch
      avalanch: {
        node: array(process.env.AVALANCHE_NODE ?? '[]'),
        historicalNode: array(process.env.AVALANCHE_NODE_HISTORICAL ?? '[]'),
        inspectors: array(process.env.AVALANCHE_INSPECTORS ?? '[]'),
        consumers: array(process.env.AVALANCHE_CONSUMERS ?? '[]'),
        avgBlockTime: 1,
      },
      // Local
      local: {
        node: array(process.env.ETH_LOCAL_NODE ?? '[]'),
        historicalNode: array(process.env.ETH_LOCAL_NODE_HISTORICAL ?? '[]'),
        inspectors: array(process.env.ETH_LOCAL_INSPECTORS ?? '[]'),
        consumers: array(process.env.ETH_LOCAL_CONSUMERS ?? '[]'),
        avgBlockTime: 0.1,
      },
    } as EthereumConfig,
  },
  email: {
    from: process.env.EMAIL_FROM ?? '',
    host: process.env.EMAIL_SMTP_HOST ?? '',
    port: int(process.env.EMAIL_SMTP_PORT ?? '25'),
    auth: {
      user: process.env.EMAIL_SMTP_USER ?? '',
      pass: process.env.EMAIL_SMTP_PASS ?? '',
    },
  },
  telegram: {
    token: process.env.TELEGRAM_TOKEN ?? '',
  },
  moralis: {
    serverUrl: process.env.MORALIS_SERVER ?? '',
  } as Moralis.StartOptions,
  session: {
    ttl: int(process.env.SESSION_TTL ?? '600'),
  },
  adapters: {
    host: process.env.ADAPTERS_HOST ?? 'localhost',
  },
  restakeOptimal: {
    host: process.env.RESTAKE_OPTIMAL_HOST ?? 'localhost',
  },
  log: {
    chatId: Number(process.env.LOG_TELEGRAM_CHAT ?? '0'),
  },
};
