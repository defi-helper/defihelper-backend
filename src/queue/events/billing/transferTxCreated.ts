import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';
import { abi as BalanceABI } from '@defihelper/networks/abi/Balance.json';
import { BigNumber as BN } from 'bignumber.js';
import { TransferStatus } from '@models/Billing/Entity';
import { LogJsonMessage } from '@services/Log';

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;
  const log = LogJsonMessage.debug({ source: 'eventsBillingTransferTxCreated', transferId: id });

  const transfer = await container.model.billingTransferTable().where('id', id).first();
  if (!transfer) {
    throw new Error(`Transfer "${id}" not found`);
  }
  log.ex({ status: transfer.status }).send();
  if (transfer.status !== TransferStatus.Pending) {
    return process.done();
  }
  if (transfer.blockchain !== 'ethereum') {
    throw new Error(`Invalid blockchain "${transfer.blockchain}"`);
  }

  const billingService = container.model.billingService();
  const network = container.blockchain.ethereum.byNetwork(transfer.network);
  const contracts = network.dfhContracts();
  if (contracts === null) {
    throw new Error('Contracts not deployed to target network');
  }
  const balanceAddress = contracts.BalanceUpgradable?.address ?? contracts.Balance?.address;
  log.ex({ balanceAddress }).send();
  if (balanceAddress === undefined) {
    throw new Error('Balance contract not deployed on target network');
  }
  const provider = network.provider();
  const balance = container.blockchain.ethereum.contract(balanceAddress, BalanceABI, provider);

  try {
    const tx = await provider.getTransaction(transfer.tx);
    log.ex({ txHash: tx?.hash }).send();
    if (tx === null) {
      await billingService.transferReject(transfer, 'Transaction not found');
      return process.done();
    }
    const receipt = await provider.waitForTransaction(transfer.tx, 1, 10000);
    log.ex({ receiptStatus: receipt?.status }).send();
    if (receipt.status === 0) {
      return process.later(dayjs().add(10, 'seconds').toDate());
    }

    const event = receipt.logs
      .map((topic) => {
        try {
          return balance.interface.parseLog(topic);
        } catch {
          return null;
        }
      })
      .find((topic) => topic && ['Deposit', 'Refund'].includes(topic.name));
    if (!event) {
      await billingService.transferReject(transfer, 'Transaction  not include target event');
      return process.done();
    }
    if (event.args.recipient.toLowerCase() !== transfer.account.toLowerCase()) {
      await billingService.transferReject(transfer, 'Invalid recipient');
      return process.done();
    }

    await container.model
      .billingService()
      .transferConfirm(
        transfer,
        new BN(event.args.amount.toString())
          .div(`1e${network.nativeTokenDetails.decimals}`)
          .multipliedBy(event.name === 'Deposit' ? 1 : -1),
        await provider
          .getBlock(receipt.blockHash)
          .then(({ timestamp }) => dayjs.unix(timestamp).toDate()),
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
