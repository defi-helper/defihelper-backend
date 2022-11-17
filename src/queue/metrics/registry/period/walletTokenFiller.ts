import container from '@container';
import { RegistryPeriod } from '@models/Metric/Entity';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';

interface Params {
  date: string;
  period: 'day' | 'week' | 'month';
}

export default async (process: Process) => {
  const { date, period } = process.task.params as Params;
  const fromDate = dayjs(date).startOf(period).toDate();
  const toDate = dayjs(date).add(1, period).startOf(period).toDate();

  const db = container.database();
  const balanceData = await container.model
    .metricWalletTokenTable()
    .distinctOn('contract', 'wallet', 'token')
    .columns<
      Array<{
        contract: string;
        wallet: string;
        token: string;
        usd: string;
        balance: string;
      }>
    >([
      'contract',
      'wallet',
      'token',
      db.raw(`data->>'usd' as "usd"`),
      db.raw(`data->>'balance' as "balance"`),
    ])
    .whereBetween('date', [fromDate, toDate])
    .whereRaw(`data->>'usd' IS NOT NULL`)
    .orderBy('contract')
    .orderBy('wallet')
    .orderBy('token')
    .orderBy('date', 'desc')
    .then(
      (rows) => new Map(rows.map((row) => [`${row.wallet}:${row.contract}:${row.token}`, row])),
    );

  const metricsService = container.model.metricService();
  await container.database().transaction((trx) =>
    Promise.all([
      metricsService.cleanWalletTokenRegistry(period as RegistryPeriod, fromDate, trx),
      Array.from(new Set(balanceData.keys()).values()).reduce<Promise<unknown>>(async (prev, k) => {
        await prev;

        const balance = balanceData.get(k);
        if (!balance) return null;

        return metricsService.createWalletTokenRegistry(
          balance.contract,
          balance.wallet,
          balance.token,
          {
            balance: balance.balance,
            usd: balance.usd,
          },
          period as RegistryPeriod,
          fromDate,
          trx,
        );
      }, Promise.resolve(null)),
    ]),
  );

  return process.done();
};
