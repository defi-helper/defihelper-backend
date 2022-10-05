import container from '@container';
import { metricContractTaskTableName } from '@models/Metric/Entity';
import {
  Contract,
  contractBlockchainTableName,
  ContractBlockchainType,
  contractTableName,
} from '@models/Protocol/Entity';
import { Process, TaskStatus } from '@models/Queue/Entity';

export default async (process: Process) => {
  const metricService = container.model.metricService();
  const queue = container.model.queueService();

  const contracts: Array<Contract & ContractBlockchainType & { task: string | null }> =
    await container.model
      .contractTable()
      .columns([
        `${contractTableName}.*`,
        `${contractBlockchainTableName}.*`,
        `${metricContractTaskTableName}.task`,
      ])
      .innerJoin(
        contractBlockchainTableName,
        `${contractTableName}.id`,
        `${contractBlockchainTableName}.id`,
      )
      .leftJoin(
        metricContractTaskTableName,
        `${metricContractTaskTableName}.contract`,
        `${contractTableName}.id`,
      )
      .where(`${contractTableName}.deprecated`, false);

  await contracts.reduce<Promise<unknown>>(async (prev, contract) => {
    await prev;

    const network = container.blockchain[contract.blockchain].byNetwork(contract.network);
    if (!network.hasProvider) return null;

    let task;
    if (contract.task) {
      task = await queue.queueTable().where('id', contract.task).first();
      if (task) {
        if ([TaskStatus.Pending, TaskStatus.Process].includes(task.status)) return null;
        return queue.resetAndRestart(task);
      }
    }
    task = await queue.push(
      'metricsContractCurrent',
      { contract: contract.id },
      { topic: 'metricCurrent' },
    );
    return metricService.setContractTask(contract, task);
  }, Promise.resolve(null));

  return process.done();
};
