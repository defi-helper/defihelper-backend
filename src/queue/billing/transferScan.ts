import BN from 'bignumber.js';
import container from '@container';
import dayjs from 'dayjs';
import { Process } from '@models/Queue/Entity';
import { Blockchain } from '@models/types';
import { ethers } from 'ethers';
import { abi as balanceAbi } from '@defihelper/networks/abi/Balance.json';
import { TransferStatus } from '@models/Billing/Entity';

const ethFeeDecimals = new BN(10).pow(18);

async function registerTransfer(
  blockchain: Blockchain,
  network: string,
  events: ethers.Event[],
  k: number,
) {
  const duplicates = await container.model
    .billingTransferTable()
    .where({ blockchain, network })
    .whereIn(
      'tx',
      events.map(({ transactionHash }) => transactionHash),
    );
  const billingService = container.model.billingService();
  return Promise.all(
    events.map(async ({ getBlock, transactionHash, args }) => {
      if (args === undefined) return null;

      const { timestamp } = await getBlock();
      const duplicate = duplicates.find(({ tx }) => transactionHash === tx);
      if (duplicate) {
        if (duplicate.status !== TransferStatus.Pending) return null;

        return billingService.transferConfirm(
          duplicate,
          new BN(args.amount.toString()).div(ethFeeDecimals).multipliedBy(k),
          dayjs.unix(timestamp).toDate(),
        );
      }

      return billingService.transfer(
        blockchain,
        network,
        args.recipient.toLowerCase(),
        new BN(args.amount.toString()).div(ethFeeDecimals).multipliedBy(k),
        transactionHash,
        true,
        dayjs.unix(timestamp).toDate(),
      );
    }),
  );
}

export interface Params {
  blockchain: Blockchain;
  network: string;
  from: number;
  step: number;
  lag?: number;
}

export default async (process: Process) => {
  const { blockchain, network, from, step, lag = 0 } = process.task.params as Params;
  if (blockchain !== 'ethereum') {
    throw new Error('Invalid blockchain');
  }
  const blockchainContainer = container.blockchain[blockchain];
  const networkContainer = blockchainContainer.byNetwork(network);
  const contracts = networkContainer.dfhContracts();
  if (contracts === null) {
    throw new Error('Contracts not deployed to target network');
  }
  const balanceAddress = contracts.BalanceUpgradable?.address ?? contracts.Balance?.address;
  if (balanceAddress === undefined) {
    throw new Error('Balance contract not deployed on this network');
  }
  const provider = networkContainer.provider();
  const balance = blockchainContainer.contract(balanceAddress, balanceAbi, provider);

  const currentBlockNumber = await provider
    .getBlockNumber()
    .then((v) => v - lag)
    .catch((e) => e);
  if (typeof currentBlockNumber !== 'number') {
    return process.laterAt(1, 'minutes').info(`${currentBlockNumber}`);
  }
  if (currentBlockNumber < from) {
    return process.laterAt(1, 'minutes');
  }
  const to = from + step > currentBlockNumber ? currentBlockNumber : from + step;

  try {
    await Promise.all([
      registerTransfer(
        blockchain,
        network,
        await balance.queryFilter(balance.filters.Deposit(), from, to),
        1,
      ),
      registerTransfer(
        blockchain,
        network,
        await balance.queryFilter(balance.filters.Refund(), from, to),
        -1,
      ),
    ]);
  } catch (e) {
    if (currentBlockNumber - from > 100) {
      throw new Error(`Task ${process.task.id}, lag: ${currentBlockNumber - from}, message: ${e}`);
    }
    return process.laterAt(1, 'minutes').info(`${e}`);
  }

  return process.param({ ...process.task.params, from: to + 1 }).laterAt(1, 'minutes');
};
