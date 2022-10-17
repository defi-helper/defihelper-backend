import BN from 'bignumber.js';
import container from '@container';
import dayjs from 'dayjs';
import { Process } from '@models/Queue/Entity';
import { Blockchain } from '@models/types';
import { ethers } from 'ethers';
import { abi as balanceAbi } from '@defihelper/networks/abi/Balance.json';

const ethFeeDecimals = new BN(10).pow(18);

async function registerClaims(
  blockchain: Blockchain,
  network: string,
  balance: ethers.Contract,
  events: ethers.Event[],
) {
  const duplicates = await container.model
    .billingBillTable()
    .column('tx')
    .where(function () {
      this.where({ blockchain, network });
      this.whereIn(
        'tx',
        events.map(({ transactionHash }) => transactionHash),
      );
    });
  const duplicatesTx = duplicates.map(({ tx }) => tx);
  const billingService = container.model.billingService();

  return Promise.all(
    events.map(async ({ getBlock, transactionHash, args }) => {
      if (!args || duplicatesTx.includes(transactionHash)) return null;
      const { timestamp } = await getBlock();
      const billId = parseInt(args.bill.toString(), 10);
      const bill = await balance.bills(billId);

      return billingService.claim(
        billId,
        blockchain,
        network,
        args.account.toLowerCase(),
        bill.claimant.toLowerCase(),
        new BN(bill.gasFee.toString()).div(ethFeeDecimals),
        new BN(bill.protocolFee.toString()).div(ethFeeDecimals),
        args.description,
        transactionHash,
        dayjs.unix(timestamp).toDate(),
      );
    }),
  );
}

async function registerAcceptBill(
  network: string,
  balance: ethers.Contract,
  events: ethers.Event[],
) {
  const billingService = container.model.billingService();
  return Promise.all(
    events.map(async ({ getBlock, transactionHash, args }) => {
      if (!args) return null;
      const { timestamp } = await getBlock();
      const billId = Number(args.bill.toString());
      const bill = await balance.bills(billId);
      const claim = await billingService
        .billTable()
        .where('blockchain', 'ethereum')
        .where('network', network)
        .where('number', billId)
        .first();
      if (!claim) return null;

      return billingService.acceptBill(
        claim,
        new BN(bill.gasFee.toString()).div(ethFeeDecimals),
        new BN(bill.protocolFee.toString()).div(ethFeeDecimals),
        transactionHash,
        dayjs.unix(timestamp).toDate(),
      );
    }),
  );
}

async function registerRejectBill(network: string, events: ethers.Event[]) {
  const billingService = container.model.billingService();
  return Promise.all(
    events.map(async ({ getBlock, transactionHash, args }) => {
      if (!args) return null;
      const { timestamp } = await getBlock();
      const billId = Number(args.bill.toString());
      const claim = await billingService
        .billTable()
        .where('blockchain', 'ethereum')
        .where('network', network)
        .where('number', billId)
        .first();
      if (!claim) return null;

      return billingService.rejectBill(claim, transactionHash, dayjs.unix(timestamp).toDate());
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
    await registerClaims(
      blockchain,
      network,
      balance,
      await balance.queryFilter(balance.filters.Claim(), from, to),
    );
    await Promise.all([
      registerAcceptBill(
        network,
        balance,
        await balance.queryFilter(balance.filters.AcceptClaim(), from, to),
      ),
      registerRejectBill(
        network,
        await balance.queryFilter(balance.filters.RejectClaim(), from, to),
      ),
    ]);
  } catch (e) {
    if (currentBlockNumber - from > 200) {
      throw new Error(`Task ${process.task.id}, lag: ${currentBlockNumber - from}, message: ${e}`);
    }
    return process.laterAt(1, 'minutes').info(`${e}`);
  }

  return process.param({ ...process.task.params, from: to + 1 }).laterAt(1, 'minutes');
};
