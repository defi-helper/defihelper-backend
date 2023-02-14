import container from '@container';
import { ContractRebalanceStatus } from '@models/Automate/Entity';
import { Process } from '@models/Queue/Entity';
import { useEthereumFreeConsumer } from '@services/Blockchain/Consumer';
import { ethers } from 'ethers';

type Uni3AutomateAdapterFactory = (
  signer: ethers.Signer,
  contract: string,
) => Promise<{
  rebalance: {
    methods: {
      canRebalance: () => Promise<Error | true>;
      rebalance: () => Promise<{ tx: ethers.ContractTransaction }>;
    };
  };
}>;

interface Uni3ProtocolAdapter {
  automates: Record<string, Uni3AutomateAdapterFactory | undefined>;
}

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const automate = await container.model.automateContractTable().where('id', id).first();
  if (!automate) {
    throw new Error('Automate not found');
  }

  const rebalance = await container.model
    .automateContractRebalanceTable()
    .where('contract', automate.id)
    .first();
  if (!rebalance || rebalance.status === ContractRebalanceStatus.Sended) {
    return process.done();
  }

  const protocol = await container.model.protocolTable().where('id', automate.protocol).first();
  if (!protocol) {
    throw new Error('Protocol not found');
  }

  const ownerWallet = await container.model
    .walletBlockchainTable()
    .where('id', automate.wallet)
    .first();
  if (!ownerWallet) {
    throw new Error('Owner wallet not found');
  }
  if (ownerWallet.blockchain !== 'ethereum') {
    throw new Error('Ethereum blockchain supported only');
  }

  const { automates } = await container.blockchainAdapter.loadAdapter<Uni3ProtocolAdapter>(
    protocol.adapter,
  );
  const adapterFactory = automates[automate.adapter];
  if (!adapterFactory) {
    throw new Error('Automate adapter not found');
  }

  const consumer = await useEthereumFreeConsumer(ownerWallet.network);
  if (consumer === null) {
    throw new Error('Not free consumer');
  }

  try {
    const {
      rebalance: { methods },
    } = await adapterFactory(consumer.consumer, automate.address);

    const canRebalance = await methods.canRebalance();
    if (canRebalance instanceof Error) {
      throw canRebalance;
    }

    const isLocked = await container.model.automateService().lockRebalance(rebalance);
    if (!isLocked) {
      return process.done();
    }

    try {
      const { tx } = await methods.rebalance();

      const rebalanceTx = await container.model.automateService().rebalanceTx(rebalance, tx.hash);
      await container.model.queueService().push('automateUni3RebalanceTx', { id: rebalanceTx.id });
    } catch (e) {
      await container.model.automateService().unlockRebalance(rebalance);
      throw e;
    }
  } finally {
    await consumer.unlock();
  }

  return process.done();
};
