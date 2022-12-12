import container from '@container';
import { RegistryPeriod } from '@models/Metric/Entity';
import { Process } from '@models/Queue/Entity';
import { RiskFactor } from '@services/RiskRanking';
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
  const [riskData, usdData] = await Promise.all([
    container.model
      .metricTokenTable()
      .distinctOn('token')
      .columns<
        Array<{
          token: string;
          totalRate: RiskFactor;
          reliabilityRate: RiskFactor;
          profitabilityRate: RiskFactor;
          volatilityRate: RiskFactor;
          total: string;
          reliability: string;
          profitability: string;
          volatility: string;
        }>
      >([
        'token',
        db.raw(`data->>'totalRate' as "totalRate"`),
        db.raw(`data->>'reliabilityRate' as "reliabilityRate"`),
        db.raw(`data->>'profitabilityRate' as "profitabilityRate"`),
        db.raw(`data->>'volatilityRate' as "volatilityRate"`),
        db.raw(`data->>'total' as "total"`),
        db.raw(`data->>'reliability' as "reliability"`),
        db.raw(`data->>'profitability' as "profitability"`),
        db.raw(`data->>'volatility' as "volatility"`),
      ])
      .whereBetween('date', [fromDate, toDate])
      .whereRaw(`data->>'totalRate' IS NOT NULL`)
      .orderBy('token')
      .orderBy('date', 'desc')
      .then((rows) => new Map(rows.map((row) => [row.token, row]))),
    container.model
      .metricTokenTable()
      .distinctOn('token')
      .columns<Array<{ token: string; usd: string }>>(['token', db.raw(`data->>'usd' as "usd"`)])
      .whereBetween('date', [fromDate, toDate])
      .whereRaw(`data->>'usd' IS NOT NULL`)
      .orderBy('token')
      .orderBy('date', 'desc')
      .then((rows) => new Map(rows.map((row) => [row.token, row]))),
  ]);

  const metricsService = container.model.metricService();
  await container.database().transaction((trx) =>
    Promise.all([
      metricsService.cleanTokenRegistry(period as RegistryPeriod, fromDate, trx),
      Array.from(new Set([...riskData.keys(), ...usdData.keys()]).values()).reduce<
        Promise<unknown>
      >(async (prev, token) => {
        await prev;

        const risk = riskData.get(token);
        const usd = usdData.get(token);

        return metricsService.createTokenRegistry(
          token,
          {
            totalRate: risk?.totalRate,
            reliabilityRate: risk?.reliabilityRate,
            profitabilityRate: risk?.profitabilityRate,
            volatilityRate: risk?.volatilityRate,
            total: risk?.total,
            reliability: risk?.reliability,
            profitability: risk?.profitability,
            volatility: risk?.volatility,
            usd: usd?.usd,
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
