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
      this.where({ blockchain, network }).whereIn(
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
        new BN(bill.gasFee.toString()).div(ethFeeDecimals).toNumber(),
        new BN(bill.protocolFee.toString()).div(ethFeeDecimals).toNumber(),
        args.description,
        transactionHash,
        dayjs.unix(timestamp).toDate(),
      );
    }),
  );
}

async function registerAcceptBill(balance: ethers.Contract, events: ethers.Event[]) {
  const billingService = container.model.billingService();
  return Promise.all(
    events.map(async ({ getBlock, transactionHash, args }) => {
      if (!args) return null;
      const { timestamp } = await getBlock();
      const billId = parseInt(args.bill.toString(), 10);
      const bill = await balance.bills(billId);
      const claim = await billingService.billTable().where('number', billId).first();
      if (!claim) return null;

      return billingService.acceptBill(
        claim,
        new BN(bill.gasFee.toString()).div(ethFeeDecimals).toNumber(),
        new BN(bill.protocolFee.toString()).div(ethFeeDecimals).toNumber(),
        transactionHash,
        dayjs.unix(timestamp).toDate(),
      );
    }),
  );
}

async function registerRejectBill(events: ethers.Event[]) {
  const billingService = container.model.billingService();
  return Promise.all(
    events.map(async ({ getBlock, transactionHash, args }) => {
      if (!args) return null;
      const { timestamp } = await getBlock();
      const billId = parseInt(args.bill.toString(), 10);
      const claim = await billingService.billTable().where('number', billId).first();
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
}

export default async (process: Process) => {
  const { blockchain, network, from, step } = process.task.params as Params;
  if (blockchain !== 'ethereum') {
    throw new Error('Invalid blockchain');
  }
  if (!isKey(contracts, network)) {
    throw new Error('Contracts not deployed to target network');
  }

  const later = dayjs().add(1, 'minute').toDate();
  const provider = container.blockchain[blockchain].byNetwork(network).provider();
  const currentBlockNumber = parseInt((await provider.getBlockNumber()).toString(), 10);
  if (currentBlockNumber < from) {
    return process.later(later);
  }
  const to = from + step > currentBlockNumber ? currentBlockNumber : from + step;

  const networkContracts = contracts[network] as { [name: string]: { address: string } };
  const balanceAddress = networkContracts.Balance.address;
  const balance = container.blockchain[blockchain].contract(balanceAddress, balanceAbi, provider);

  await registerClaims(
    blockchain,
    network,
    balance,
    await balance.queryFilter(balance.filters.Claim(), from, to),
  );
  await Promise.all([
    registerAcceptBill(balance, await balance.queryFilter(balance.filters.AcceptClaim(), from, to)),
    registerRejectBill(await balance.queryFilter(balance.filters.RejectClaim(), from, to)),
  ]);

  return process.param({ ...process.task.params, from: to + 1 }).later(later);
};
