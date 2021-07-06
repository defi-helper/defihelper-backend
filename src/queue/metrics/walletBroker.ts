import container from '@container';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();
  const links = await container.model.walletContractLinkTable();
  await Promise.all(
    links.map(async (link) => {
      queue.push('metricsWallet', {
        contract: link.contract,
        wallet: link.wallet,
        blockNumber: 'latest',
      });
    }),
  );

  return process.done();
};
