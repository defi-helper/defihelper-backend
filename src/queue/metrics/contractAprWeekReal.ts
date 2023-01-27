import container from '@container';
import { Process } from '@models/Queue/Entity';
import { RegistryPeriod } from '@models/Metric/Entity';
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
    .where(`${contractTableName}.id`, contractId)
    .first();
  if (!contract) throw new Error('Contract not found');

  const periodStart = dayjs().add(-period, 'days');
  dayjs.extend(utc);
  const database = container.database();
  const contractMetricRows = await container.model
    .metricContractRegistryTable()
    .where('contract', contract.id)
    .where('period', RegistryPeriod.Day)
    .where('date', '>=', periodStart.startOf('day').toDate())
    .where(database.raw(`data->>'aprDay' IS NOT NULL`))
    .orderBy('date', 'desc');
  if (contractMetricRows.length === 0) throw new Error('Contract metrics not found');

  const apr = contractMetricRows.reduce<{ [date: string]: string }>(
    (result, metric) => ({
      ...result,
      [dayjs(metric.date).utc().format('YYYY-MM-DD')]: metric.data.aprDay ?? '0',
    }),
    {},
  );
  const aprValues = Object.values(apr);
  const avgApr =
    aprValues.length > 0
      ? Array.from(aprValues)
          .reduce((sum, v) => sum.plus(v), new BN(0))
          .div(aprValues.length)
      : new BN(0);

  const stakeTokenLink = await container.model
    .tokenContractLinkTable()
    .where('contract', contract.id)
    .where('type', TokenContractLinkType.Stake)
    .first();
  if (stakeTokenLink === undefined) throw new Error('Staking token for contract not found');

  const tokenPrices = await container.model
    .metricTokenRegistryTable()
    .where('token', stakeTokenLink.token)
    .where('period', RegistryPeriod.Day)
    .where('date', '>=', periodStart.startOf('day').toDate())
    .where(database.raw(`data->>'usd' IS NOT NULL`))
    .orderBy('date');
  if (tokenPrices.length === 0) throw new Error('Staking token prices not found');

  const price = tokenPrices.reduce<{ [date: string]: string }>(
    (result, metric) => ({
      ...result,
      [dayjs(metric.date).utc().format('YYYY-MM-DD')]: metric.data.usd ?? '0',
    }),
    {},
  );
  const avgPriceValues = Object.values(price);
  const avgPrice =
    avgPriceValues.length > 0
      ? Array.from(avgPriceValues)
          .reduce((sum, v) => sum.plus(v), new BN(0))
          .div(avgPriceValues.length)
      : new BN(0);

  const data = Array.from(new Array(period).keys()).reduceRight<
    Array<{ stake: string; stakeUSD: string; dayRewardUSD: string }>
  >((result, dayAgo) => {
    const day = dayjs().add(-dayAgo, 'days').startOf('day').utc().format('YYYY-MM-DD');
    const stakingTokenPriceUSD = price[day] ?? avgPrice.toString(10);
    const aprDay = apr[day] ?? avgApr.toString(10);
    const stake = new BN(
      result[result.length - 1]?.stake ?? stakingTokenPriceUSD !== '0'
        ? new BN(investing).div(stakingTokenPriceUSD)
        : '0',
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

  await container.model.metricService().createContract(
    contract,
    {
      aprWeekReal:
        investing > 0
          ? endInvestingUSD.plus(cumulativeEarned).minus(investing).div(investing).toString(10)
          : '0',
    },
    new Date(),
  );

  return process.done();
};
