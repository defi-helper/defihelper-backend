import container from '@container';
import { RegistryPeriod } from '@models/Metric/Entity';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';

interface Params {
  date: string;
}

export default async (process: Process) => {
  const { date } = process.task.params as Params;
  const fromDate = dayjs(date).startOf('day').toDate();
  const toDate = dayjs(date).add(1, 'day').startOf('day').toDate();
  const period: [Date, Date] = [fromDate, toDate];

  const db = container.database();
  const [tvlData, uniqWalletsData] = await Promise.all([
    container.model
      .metricContractTable()
      .distinctOn('contract')
      .columns<
        Array<{
          contract: string;
          tvl: string;
          aprDay: string | null;
          aprWeek: string | null;
          aprMonth: string | null;
          aprYear: string | null;
        }>
      >([
        'contract',
        db.raw(`data->>'tvl' as "tvl"`),
        db.raw(`data->>'aprDay' as "aprDay"`),
        db.raw(`data->>'aprWeek' as "aprWeek"`),
        db.raw(`data->>'aprMonth' as "aprMonth"`),
        db.raw(`data->>'aprYear' as "aprYear"`),
      ])
      .whereBetween('date', period)
      .whereRaw(`data->>'tvl' IS NOT NULL`)
      .orderBy('contract')
      .orderBy('date', 'desc'),
    container.model
      .metricContractTable()
      .distinctOn('contract')
      .columns<Array<{ contract: string; uniqueWalletsCount: string }>>([
        'contract',
        db.raw(`data->>'uniqueWalletsCount' as "uniqueWalletsCount"`),
      ])
      .whereBetween('date', period)
      .whereRaw(`data->>'uniqueWalletsCount' IS NOT NULL`)
      .orderBy('contract')
      .orderBy('date', 'desc')
      .then((rows) => new Map(rows.map((row) => [row.contract, row]))),
  ]);

  const metricsService = container.model.metricService();
  container.database().transaction((trx) =>
    Promise.all([
      metricsService.cleanContractRegistry(RegistryPeriod.Day, fromDate, trx),
      tvlData.reduce<Promise<unknown>>(async (prev, data) => {
        await prev;
        return metricsService.createContractRegistry(
          data.contract,
          {
            tvl: data.tvl,
            aprDay: data.aprDay ?? '0',
            aprWeek: data.aprWeek ?? '0',
            aprMonth: data.aprMonth ?? '0',
            aprYear: data.aprYear ?? '0',
            uniqueWalletsCount: uniqWalletsData.get(data.contract)?.uniqueWalletsCount ?? '0',
          },
          RegistryPeriod.Day,
          fromDate,
          trx,
        );
      }, Promise.resolve(null)),
    ]),
  );

  return process.done();
};
