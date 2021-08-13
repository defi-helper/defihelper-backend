import container from '@container';

export default async () => {
  return Promise.all([
    container.model
      .queueTable()
      .update('handler', 'metricsContractBlock')
      .where('handler', 'metricsContract'),
    container.model
      .queueTable()
      .update('handler', 'metricsWalletBlock')
      .where('handler', 'metricsWallet'),
  ]);
};
