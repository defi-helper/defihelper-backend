import container from '@container';
import { Process } from '@models/Queue/Entity';

export interface Params {
  contract: string;
}

export default async (process: Process) => {
  const { contract } = process.task.params as Params;

  const [contractaa] = await Promise.all([
    container.model.automateContractTable().where('id', contract).first(),
  ]);

  return process.done();
};
