import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';
import { abi as BalanceABI } from '@defihelper/networks/abi/Balance.json';
import contracts from '@defihelper/networks/contracts.json';
import { isKey } from '@services/types';
import { ethers } from 'ethers';
import { BigNumber as BN } from 'bignumber.js';
import { TransferStatus } from '@models/Billing/Entity';

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const transfer = await container.model.billingTransferTable().where('id', id).first();
  if (!transfer) {
    throw new Error(`Order call "${id}" not found`);
  }
  if (transfer.status !== TransferStatus.Pending) {
    return process.done();
  }
  if (transfer.blockchain !== 'ethereum') {
    throw new Error(`Invalid blockchain "${transfer.blockchain}"`);
  }
  if (!isKey(contracts, transfer.network)) {
    throw new Error('Contracts not deployed to target network');
  }

  const billingService = container.model.billingService();
  const provider = container.blockchain.ethereum.byNetwork(transfer.network).provider();
  const networkContracts = contracts[transfer.network] as { [name: string]: { address: string } };
  const balance = container.blockchain.ethereum.contract(
    networkContracts.Balance.address,
    BalanceABI,
  );
  try {
    const tx = await provider.getTransaction(transfer.tx);
    if (tx === null) {
      await billingService.transferReject(transfer, 'Transaction not found');
      return process.done();
    }
    const receipt = await provider.waitForTransaction(transfer.tx, 1, 10000);
    if (receipt.status === 0) {
      return process.later(dayjs().add(10, 'seconds').toDate());
    }

    const event = receipt.logs.reduce<ethers.utils.LogDescription | null>((prev, topic) => {
      if (prev !== null) return null;
      const logDescription = balance.interface.parseLog(topic);
      return ['Deposit', 'Refund'].includes(logDescription.name) ? logDescription : null;
    }, null);
    if (!event) {
      await billingService.transferReject(transfer, 'Transaction  not include target event');
      return process.done();
    }
    if (event.args.recipient.toLowerCase() !== transfer.account.toLowerCase()) {
      await billingService.transferReject(transfer, 'Invalid recipient');
      return process.done();
    }
    const timestamp = await provider.getBlock(receipt.blockHash).then((block) => block.timestamp);

    await container.model.billingService().transferConfirm(
      transfer,
      new BN(event.args.amount.toString())
        .div('1e18')
        .multipliedBy(event.name === 'Deposit' ? 1 : -1)
        .toNumber(),
      dayjs.unix(timestamp).toDate(),
    );
  } catch (e) {
    if (e instanceof Error) {
      if (e.message.includes('timeout exceeded')) {
        return process.later(dayjs().add(10, 'seconds').toDate());
      }
      if (e.message.includes('no matching event')) {
        await billingService.transferReject(transfer, 'Traget transaction not matching event');
        return process.done();
      }
    }
    return process.error(<Error>e);
  }

  return process.done();
};
