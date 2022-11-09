import container from '@container';

export default async () => {
  await Promise.all([
    container.model.userTable().update({ isMetricsTracked: true }),
    container.model.queueService().push('metricsTrackingConditionsBroker'),
  ]);
};
