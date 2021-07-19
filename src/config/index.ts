import dotenv from 'dotenv';

dotenv.config();

export default {
  api: {
    port: parseInt(process.env.API_PORT ?? '9000', 10),
    externalUrl: process.env.API_EXTERNAL_URL ?? 'https://backend-local.defihelper.io/',
    internalUrl: process.env.API_INTERNAL_URL ?? 'https://backend-local.defihelper.io',
    secret: process.env.API_SECRET ?? 'defiHelperApiSecret',
  },
  scanner: {
    host: process.env.SCANNER_HOST ?? 'https://scanner-local.defihelper.io',
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
      ethMainAvgBlockTime: 13.2,
      bscMainNode: process.env.BSC_NODE ?? '',
      bscMainAvgBlockTime: 3,
    },
  },
  email: {
    from: process.env.EMAIL_FROM ?? '',
    host: process.env.EMAIL_SMTP_HOST ?? '',
    port: parseInt(process.env.EMAIL_SMTP_PORT ?? '25', 10),
    auth: {
      user: process.env.EMAIL_SMTP_USER ?? '',
      pass: process.env.EMAIL_SMTP_PASS ?? '',
    },
  },
  telegram: {
    token: process.env.TELEGRAM_TOKEN ?? '',
  },
  session: {
    ttl: parseInt(process.env.SESSION_TTL ?? '600', 10),
  },
  adapters: {
    host: process.env.ADAPTERS_HOST ?? 'localhost',
  },
};
