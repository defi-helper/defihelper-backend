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
  const stakingData = await container.model
    .metricWalletTable()
    .distinctOn('contract', 'wallet')
    .columns<
      Array<{
        contract: string;
        wallet: string;
        staking: string;
        stakingUSD: string;
        earned: string;
        earnedUSD: string;
      }>
    >([
      'contract',
      'wallet',
      db.raw(`data->>'staking' as "staking"`),
      db.raw(`data->>'stakingUSD' as "stakingUSD"`),
      db.raw(`data->>'earned' as "earned"`),
      db.raw(`data->>'earnedUSD' as "earnedUSD"`),
    ])
    .whereBetween('date', [fromDate, toDate])
    .whereRaw(`data->>'staking' IS NOT NULL`)
    .orderBy('contract')
    .orderBy('wallet')
    .orderBy('date', 'desc')
    .then((rows) => new Map(rows.map((row) => [`${row.wallet}:${row.contract}`, row])));

  const metricsService = container.model.metricService();
  await container.database().transaction((trx) =>
    Promise.all([
      metricsService.cleanWalletRegistry(period as RegistryPeriod, fromDate, trx),
      Array.from(new Set(stakingData.keys()).values()).reduce<Promise<unknown>>(async (prev, k) => {
        await prev;

        const staking = stakingData.get(k);
        if (!staking) return null;

        return metricsService.createWalletRegistry(
          staking.contract,
          staking.wallet,
          {
            staking: staking.staking,
            stakingUSD: staking.stakingUSD,
            earned: staking.earned,
            earnedUSD: staking.earnedUSD,
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
