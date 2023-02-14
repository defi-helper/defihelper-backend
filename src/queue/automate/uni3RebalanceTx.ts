import container from '@container';
import { ContractRebalanceTxStatus } from '@models/Automate/Entity';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';
import { ethers } from 'ethers';

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const rebalanceTx = await container.model
    .automateContractRebalanceTxTable()
    .where('id', id)
    .first();
  if (!rebalanceTx) {
    throw new Error('Automate rebalance transaction not found');
  }
  if (rebalanceTx.status !== ContractRebalanceTxStatus.Pending) {
    return process.done();
  }

  const rebalance = await container.model
    .automateContractRebalanceTable()
    .where('id', rebalanceTx.rebalance)
    .first();
  if (!rebalance) {
    throw new Error('Automate rebalance not found');
  }

  const automate = await container.model
    .automateContractTable()
    .where('id', rebalance.contract)
    .first();
  if (!automate) {
    throw new Error('Automate not found');
  }

  const ownerWallet = await container.model
    .walletBlockchainTable()
    .where('id', automate.wallet)
    .first();
  if (!ownerWallet) {
    throw new Error('Owner wallet not found');
  }

  const automateService = container.model.automateService();
  const provider = container.blockchain.ethereum.byNetwork(ownerWallet.network).provider();
  try {
    const receipt = await provider.waitForTransaction(rebalanceTx.tx, 1, 10000);
    if (receipt.status === 0) {
      const tx = await provider.getTransaction(rebalanceTx.tx);
      const code = await provider.call(tx as any, tx.blockNumber);
      const reason = ethers.utils.toUtf8String(`0x${code.slice(138)}`);
      if (reason.indexOf('Transaction too old') === 0) {
        await Promise.all([
          automateService.unlockRebalance(rebalance),
          automateService.rebalanceTxError(rebalanceTx, 'Transaction  too old'),
        ]);
        return process.done();
      }
      await automateService.rebalanceTxError(rebalanceTx, reason);
      return process.done();
    }

    await container.model
      .queueService()
      .push('billingClaimReceiptResolver', { network: ownerWallet.network, txId: rebalanceTx.tx });

    const parser = new ethers.utils.Interface(['event RebalanceCompleted(uint256 tokenId)']);
    const event = receipt.logs.reduce<ethers.utils.LogDescription | null>((prev, topic) => {
      if (prev !== null) return prev;
      try {
        const logDescription = parser.parseLog(topic);
        return logDescription.name === 'RebalanceCompleted' ? logDescription : null;
      } catch (e) {
        return null;
      }
    }, null);
    if (!event) {
      await Promise.all([
        automateService.unlockRebalance(rebalance),
        automateService.rebalanceTxError(rebalanceTx, 'Transaction  not include target event'),
      ]);
      return process.done();
    }

    await Promise.all([
      automateService.unlockRebalance(rebalance),
      automateService.rebalanceTxCompleted(rebalanceTx),
      container.model.queueService().push(
        'metricsWalletScanMutation',
        {
          contract: automate.contract,
          wallet: automate.contractWallet,
        },
        {
          topic: 'metricCurrent',
          priority: 9,
        },
      ),
    ]);
  } catch (e) {
    if (e instanceof Error) {
      if (e.message.includes('timeout exceeded')) {
        return process.later(dayjs().add(10, 'seconds').toDate());
      }
      if (e.message.includes('no matching event')) {
        await automateService.rebalanceTxError(
          rebalanceTx,
          'Transaction  not include target event',
        );
        return process.done();
      }
    }
    throw e;
  }

  return process.done();
};
