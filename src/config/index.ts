import dotenv from 'dotenv';
dotenv.config();

export default {
  api: {
    port: parseInt(process.env.API_PORT ?? '9000', 10),
  },
  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    user: process.env.DATABASE_USER ?? '',
    password: process.env.DATABASE_PASSWORD ?? '',
    database: process.env.DATABASE_NAME ?? '',
  },
  cache: {
    host: process.env.CACHE_HOST ?? '127.0.0.1',
    port: parseInt(process.env.CACHE_PORT ?? '6379', 10),
    password: process.env.CACHE_PASSWORD ?? undefined,
    database: process.env.CACHE_DATABASE ?? undefined,
  },
  blockchain: {
    ethereum: {
      ethMainNode: process.env.ETH_NODE ?? '',
      bscMainNode: process.env.BSC_NODE ?? '',
    },
  },
  session: {
    ttl: parseInt(process.env.SESSION_TTL ?? '600', 10),
  },
  adapters: {
    host: process.env.ADAPTERS_HOST ?? 'localhost',
  },
};
