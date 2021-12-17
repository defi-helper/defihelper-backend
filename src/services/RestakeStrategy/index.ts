import container from '@container';
import { Blockchain } from '@models/types';
import axios from 'axios';
import BN from 'bignumber.js';

function range(start: number, end: number) {
  return Array.from(new Array(end).keys()).slice(start);
}

function calcAssets(balance: number, earned: number, apd: number, fee: number, period: number) {
  return balance + earned + balance * apd * period - fee;
}

function calcRestakeEveryDay(
  balance: number,
  earned: number,
  apd: number,
  fee: number,
  period: number,
) {
  const apd1 = 1 + apd;
  return (
    balance * apd1 ** period + earned * apd1 ** (period - 1) - (fee * (apd1 ** period - 1)) / apd
  );
}

function calcRestakeOptimal(
  balance: number,
  earned: number,
  apd: number,
  fee: number,
  n_days: number,
  restake_days: number[],
) {
  const res = [];
  let cBalance = balance;
  let cEarned = earned;
  let prevTick = 0;

  const ticks = range(0, n_days + 1).concat(restake_days);
  ticks.sort((a, b) => a - b);

  // eslint-disable-next-line no-restricted-syntax
  for (const tick of ticks) {
    cEarned += cBalance * apd * (tick - prevTick);
    if (restake_days.includes(tick)) {
      cBalance += cEarned - fee;
      cEarned = 0;
    }
    res.push({ t: tick, v: cBalance + cEarned });
    prevTick = tick;
  }

  return res;
}

async function ethereumFeeCalc(networkId: string) {
  const network = container.blockchain.ethereum.byNetwork(networkId);
  const avgGasPriceUSD = new BN(await network.getAvgGasPrice())
    .div(`1e${network.nativeTokenDetails.decimals}`)
    .multipliedBy(await network.nativeTokenPrice());
  return avgGasPriceUSD
    .multipliedBy(750000) // average gas used
    .plus(1) // protocol fee
    .toNumber();
}

export interface Point {
  t: number;
  v: number;
}

export function hold(balance: number, apy: number, seq: number = 365) {
  const apd = apy / 365;
  return range(1, seq + 1).reduce<Point[]>(
    (prev, period) => [...prev, { t: period, v: calcAssets(balance, 0, apd, 0, period) }],
    [{ t: 0, v: balance }],
  );
}

export async function everyDayRestake(
  blockchain: Blockchain,
  network: string,
  balance: number,
  apy: number,
  seq: number = 365,
) {
  const apd = apy / 365;
  let fee = 3;
  if (blockchain === 'ethereum') {
    fee = await ethereumFeeCalc(network);
  }

  return range(1, seq + 1).reduce<Point[]>(
    (prev, period) => {
      return [...prev, { t: period, v: calcRestakeEveryDay(balance, 0, apd, fee, period) }];
    },
    [{ t: 0, v: balance }],
  );
}

export async function optimalRestake(
  blockchain: Blockchain,
  network: string,
  balance: number,
  apy: number,
  seq: number = 365,
) {
  const apd = apy / 365;
  let fee = 3;
  if (blockchain === 'ethereum') {
    fee = await ethereumFeeCalc(network);
  }

  const { data: optimalRes } = await axios.get(
    `${container.parent.restakeOptimal.host}/optimal-seq`,
    {
      params: {
        balance,
        earned: 0,
        apd,
        fee,
        seq,
        minInterval: 3600,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
  return calcRestakeOptimal(balance, 0, apd, fee, seq, optimalRes);
}

export async function apyBoost(
  blockchain: Blockchain,
  network: string,
  balance: number,
  apy: number,
) {
  const optimalPoints = await optimalRestake(blockchain, network, balance, apy);
  const lastPoint = optimalPoints[optimalPoints.length - 1];
  if (!lastPoint) return 0;

  return new BN(lastPoint.v).minus(balance).div(balance).toString(10);
}
