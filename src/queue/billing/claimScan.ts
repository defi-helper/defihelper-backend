import BN from 'bignumber.js';
import container from '@container';
import { Process } from '@models/Queue/Entity';
import { abi as balanceAbi } from '@defihelper/networks/abi/Balance.json';

export interface Params {
  network: string;
}

export default async (process: Process) => {
  const { network } = process.task.params as Params;

  const blockchainContainer = container.blockchain.ethereum;
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

  const lastBillNumber = await container.model
    .billingBillTable()
    .where('blockchain', 'ethereum')
    .where('network', network)
    .orderBy('number', 'desc')
    .first()
    .then((row) => Number(row?.number ?? 0));

  try {
    const newBill = await balance.bills(lastBillNumber + 1);
    if (newBill.account === '0x0000000000000000000000000000000000000000') {
      return process.laterAt(1, 'minutes');
    }

    await container.model
      .billingService()
      .claim(
        newBill.id.toString(),
        'ethereum',
        network,
        newBill.account.toLowerCase(),
        newBill.claimant.toLowerCase(),
        new BN(newBill.gasFee.toString()).div(`1e${decimals}`),
        new BN(newBill.protocolFee.toString()).div(`1e${decimals}`),
        '',
        '',
      );
  } catch (e) {
    return process.laterAt(1, 'minutes').info(`${e}`);
  }

  return process.later(new Date());
};
