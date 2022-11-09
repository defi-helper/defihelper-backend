import container from '@container';

export default async () => {
  await container.model.userTable().update({ isMetricsTracked: true });
};
