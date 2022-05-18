import container from '@container';

export default async () => {
  return container.model.queueService().push('tokensDeleteDuplicates');
};
