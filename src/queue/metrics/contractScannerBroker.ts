import container from '@container';
import { Process } from '@models/Queue/Entity';

export interface Params {
  dateFrom: number;
  dateTo: number;
}

export default async (process: Process) => {
  const { dateFrom, dateTo } = process.task.params as Params;
  const queue = container.model.queueService();
  const contracts = await container.model.contractTable().where('blockchain', 'ethereum');
  await Promise.all(
    contracts.map((contract) =>
      queue.push('metricsContractScannerDate', {
        contract: contract.id,
        date: {
          from: dateFrom,
          to: dateTo,
        },
      }),
    ),
  );

  return process.done();
};
