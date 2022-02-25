import container from '@container';
import { Process } from '@models/Queue/Entity';
import { metricContractTableName, metricTokenTableName } from '@models/Metric/Entity';
import {
  contractBlockchainTableName,
  contractTableName,
  TokenContractLinkType,
} from '@models/Protocol/Entity';
import BN from 'bignumber.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

export interface Params {
  contract: string;
  period: number;
  investing: number;
}

export default async (process: Process) => {
  const { contract: contractId, period, investing } = process.task.params as Params;
  const contract = await container.model
    .contractTable()
    .innerJoin(
      contractBlockchainTableName,
      `${contractBlockchainTableName}.id`,
      `${contractTableName}.id`,
    )
    .where('id', contractId)
    .first();
  if (!contract) throw new Error('Contract not found');

  const periodStart = dayjs().add(-period, 'days');
  dayjs.extend(utc);
  const database = container.database();
  const contractMetricRows = await container.model
    .metricContractTable()
    .distinctOn('date')
    .column(database.raw(`DATE_TRUNC('day', date) AS "date"`))
    .column(database.raw(`data->>'aprDay' AS "aprDay"`))
    .where('contract', contract.id)
    .where('date', '>=', periodStart.startOf('day').toDate())
    .where(database.raw(`data->>'aprDay' IS NOT NULL`))
    .orderBy('date', 'asc')
    .orderBy(`${metricContractTableName}.date`, 'DESC')
    .then((rows) => rows as unknown as Array<{ date: Date; aprDay: string }>);
  if (contractMetricRows.length === 0) throw new Error('Contract metrics not found');

  const apr = contractMetricRows.reduce<{ [date: string]: string }>(
    (result, { date, aprDay }) => ({
      ...result,
      [dayjs(date).utc().format('YYYY-MM-DD')]: aprDay,
    }),
    {},
  );
  const avgApr = Array.from(Object.values(apr))
    .reduce((sum, v) => sum.plus(v), new BN(0))
    .div(Object.values(apr).length);

  const stakeTokenLink = await container.model
    .tokenContractLinkTable()
    .where('contract', contract.id)
    .where('type', TokenContractLinkType.Stake)
    .first();
  if (stakeTokenLink === undefined) throw new Error('Staking token for contract not found');

  const tokenPrices = await container.model
    .metricTokenTable()
    .distinctOn('date')
    .column(database.raw(`DATE_TRUNC('day', date) AS "date"`))
    .column(database.raw(`data->>'usd' AS "usd"`))
    .where('token', stakeTokenLink.token)
    .where('date', '>=', periodStart.startOf('day').toDate())
    .orderBy('date')
    .orderBy(`${metricTokenTableName}.date`, 'DESC')
    .then((rows) => rows as unknown as Array<{ date: Date; usd: string }>);
  if (tokenPrices.length === 0) throw new Error('Staking token prices not found');

  const price = tokenPrices.reduce<{ [date: string]: string }>(
    (result, { date, usd }) => ({
      ...result,
      [dayjs(date).utc().format('YYYY-MM-DD')]: usd,
    }),
    {},
  );
  const avgPrice = Array.from(Object.values(price))
    .reduce((sum, v) => sum.plus(v), new BN(0))
    .div(Object.values(price).length);

  const data = Array.from(new Array(period).keys()).reduceRight<
    Array<{ stake: string; stakeUSD: string; dayRewardUSD: string }>
  >((result, dayAgo) => {
    const day = dayjs().add(-dayAgo, 'days').startOf('day').utc().format('YYYY-MM-DD');
    const stakingTokenPriceUSD = price[day] ?? avgPrice.toString(10);
    const aprDay = apr[day] ?? avgApr.toString(10);
    const stake = new BN(
      result[result.length - 1]?.stake ?? new BN(investing).div(stakingTokenPriceUSD),
    );
    const stakeUSD = stake.multipliedBy(stakingTokenPriceUSD);
    const dayRewardUSD = stakeUSD.multipliedBy(aprDay);

    return [
      ...result,
      {
        stake: stake.toString(10),
        stakeUSD: stakeUSD.toString(10),
        dayRewardUSD: dayRewardUSD.toString(10),
      },
    ];
  }, []);

  const endInvestingUSD = new BN(data[data.length - 1].stakeUSD ?? '0');
  const cumulativeEarned = data.reduce(
    (sum, { dayRewardUSD }) => sum.plus(dayRewardUSD),
    new BN(0),
  );

  const realApr = endInvestingUSD.plus(cumulativeEarned).minus(investing).div(investing);

  await container.model.contractService().updateBlockchain({
    ...contract,
    metric: {
      ...contract.metric,
      aprWeekReal: realApr.toString(10),
    },
  });

  return process.done();
};
