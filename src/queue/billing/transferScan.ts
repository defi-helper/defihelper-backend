import BN from 'bignumber.js';
import container from '@container';
import dayjs from 'dayjs';
import { Process } from '@models/Queue/Entity';
import { Blockchain } from '@models/types';
import { isKey } from '@services/types';
import { ethers } from 'ethers';
import { abi as balanceAbi } from '@defihelper/networks/abi/Balance.json';
import contracts from '@defihelper/networks/contracts.json';

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
        if (duplicate.confirmed) return null;

        return billingService.transferConfirm(
          duplicate,
          new BN(args.amount.toString()).div(ethFeeDecimals).multipliedBy(k).toNumber(),
          dayjs.unix(timestamp).toDate(),
        );
      }

      return billingService.transfer(
        blockchain,
        network,
        args.recipient.toLowerCase(),
        new BN(args.amount.toString()).div(ethFeeDecimals).multipliedBy(k).toNumber(),
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
  if (!isKey(contracts, network)) {
    throw new Error('Contracts not deployed to target network');
  }

  const later = dayjs().add(1, 'minute').toDate();
  const provider = container.blockchain[blockchain].byNetwork(network).provider();
  const currentBlockNumber = parseInt((await provider.getBlockNumber()).toString(), 10) - lag;
  if (currentBlockNumber < from) {
    return process.later(later);
  }
  const to = from + step > currentBlockNumber ? currentBlockNumber : from + step;

  const networkContracts = contracts[network] as { [name: string]: { address: string } };
  const balanceAddress = networkContracts.Balance.address;
  const balance = container.blockchain[blockchain].contract(balanceAddress, balanceAbi, provider);

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

  return process.param({ ...process.task.params, from: to + 1 }).later(later);
};
