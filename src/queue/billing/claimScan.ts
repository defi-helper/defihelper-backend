import BN from 'bignumber.js';
import container from '@container';
import { Process } from '@models/Queue/Entity';
import { Blockchain } from '@models/types';
import { abi as balanceAbi } from '@defihelper/networks/abi/Balance.json';
import { LogJsonMessage } from '@services/Log';

export interface Params {
  blockchain: Blockchain;
  network: string;
  from: number;
  step: number;
  lag?: number;
}

export default async (process: Process) => {
  const { blockchain, network, from, step, lag = 0 } = process.task.params as Params;
  const log = LogJsonMessage.debug({
    source: 'billingClaimScan',
    taskId: process.task.id,
  });

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
  const { decimals } = networkContainer.nativeTokenDetails;

  const currentBlockNumber = await provider
    .getBlockNumber()
    .then((v) => v - lag)
    .catch((e) => e);
  log.ex({ currentBlockNumber }).send();
  if (typeof currentBlockNumber !== 'number') {
    return process.laterAt(1, 'minutes').info(`${currentBlockNumber}`);
  }
  if (currentBlockNumber < from) {
    return process.laterAt(1, 'minutes');
  }
  const to = from + step > currentBlockNumber ? currentBlockNumber : from + step;
  log.ex({ to }).send();

  try {
    const events = await balance.queryFilter(balance.filters.Claim(), from, to);
    log.ex({ eventsCount: events.length }).send();
    const duplicatesTx = await container.model
      .billingBillTable()
      .column('tx')
      .where('blockchain', blockchain)
      .where('network', network)
      .whereIn(
        'tx',
        events.map(({ transactionHash }) => transactionHash),
      )
      .then((rows) => new Set(rows.map(({ tx }) => tx)));

    const billingService = container.model.billingService();
    await Promise.all(
      events.map(async ({ transactionHash, args }) => {
        if (!args || duplicatesTx.has(transactionHash)) return null;
        const billId = args.bill.toString();
        const { claimant, gasFee, protocolFee } = await balance.bills(billId);
        log
          .ex({ billId, claimant, gasFee: gasFee.toString(), protocolFee: protocolFee.toString() })
          .send();

        return billingService.claim(
          billId,
          blockchain,
          network,
          args.account.toLowerCase(),
          claimant.toLowerCase(),
          new BN(gasFee.toString()).div(`1e${decimals}`),
          new BN(protocolFee.toString()).div(`1e${decimals}`),
          args.description,
          transactionHash,
        );
      }),
    );
  } catch (e) {
    if (currentBlockNumber - from > 200) {
      throw new Error(`Task ${process.task.id}, lag: ${currentBlockNumber - from}, message: ${e}`);
    }
    return process.laterAt(1, 'minutes').info(`${e}`);
  }

  return process.param({ ...process.task.params, from: to + 1 }).laterAt(1, 'minutes');
};
