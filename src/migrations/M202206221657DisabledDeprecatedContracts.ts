import container from '@container';

export default async () => {
  const queue = container.model.queueService();
  return container.model
    .contractTable()
    .where('deprecated', true)
    .then((contracts) =>
      contracts.map(({ id }) => queue.push('eventsContractBlockchainUpdated', { contract: id })),
    );
};
