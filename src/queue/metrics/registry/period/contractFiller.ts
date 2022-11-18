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
  const [tvlData, uniqWalletsData] = await Promise.all([
    container.model
      .metricContractTable()
      .distinctOn('contract')
      .columns<
        Array<{
          contract: string;
          tvl: string;
          aprDay: string;
          aprWeek: string;
          aprMonth: string;
          aprYear: string;
        }>
      >([
        'contract',
        db.raw(`data->>'tvl' as "tvl"`),
        db.raw(`data->>'aprDay' as "aprDay"`),
        db.raw(`data->>'aprWeek' as "aprWeek"`),
        db.raw(`data->>'aprMonth' as "aprMonth"`),
        db.raw(`data->>'aprYear' as "aprYear"`),
      ])
      .whereBetween('date', [fromDate, toDate])
      .whereRaw(`data->>'tvl' IS NOT NULL`)
      .orderBy('contract')
      .orderBy('date', 'desc')
      .then((rows) => new Map(rows.map((row) => [row.contract, row]))),
    container.model
      .metricContractTable()
      .distinctOn('contract')
      .columns<Array<{ contract: string; uniqueWalletsCount: string }>>([
        'contract',
        db.raw(`data->>'uniqueWalletsCount' as "uniqueWalletsCount"`),
      ])
      .whereBetween('date', [fromDate, toDate])
      .whereRaw(`data->>'uniqueWalletsCount' IS NOT NULL`)
      .orderBy('contract')
      .orderBy('date', 'desc')
      .then((rows) => new Map(rows.map((row) => [row.contract, row]))),
  ]);

  const metricsService = container.model.metricService();
  await container.database().transaction((trx) =>
    Promise.all([
      metricsService.cleanContractRegistry(period as RegistryPeriod, fromDate, trx),
      Array.from(new Set([...tvlData.keys(), ...uniqWalletsData.keys()]).values()).reduce<
        Promise<unknown>
      >(async (prev, contract) => {
        await prev;

        const tvl = tvlData.get(contract);
        const wallet = uniqWalletsData.get(contract);

        return metricsService.createContractRegistry(
          contract,
          {
            tvl: tvl?.tvl,
            aprDay: tvl?.aprDay,
            aprWeek: tvl?.aprWeek,
            aprMonth: tvl?.aprMonth,
            aprYear: tvl?.aprYear,
            uniqueWalletsCount: wallet?.uniqueWalletsCount,
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
