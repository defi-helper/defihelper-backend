import { Process } from '@models/Queue/Entity';
import container from '@container';
import dayjs from 'dayjs';
import * as Scanner from '@services/Scanner';

export interface ContractDeleteParams {
  contractId: string;
}

export default async (process: Process) => {
  const { contractId } = process.task.params as ContractDeleteParams;

  const scanner = container.scanner();
  const contract = await container.model.contractBlockchainTable().where('id', contractId).first();
  if (!contract) {
    throw new Error('contract not found');
  }

  if (!contract.watcherId) {
    throw new Error('contract`s watcherId not found');
  }

  const watcherContract = await scanner.getContract(contract.watcherId);
  if (watcherContract === null) {
    return process.info('already removed, ignore').done();
  }

  try {
    await scanner.deleteContract(watcherContract.id);
  } catch (e) {
    if (e instanceof Scanner.TemporaryOutOfService) {
      return process
        .info(`postponed due to temporarily service unavailability: ${e.message}`)
        .later(dayjs().add(5, 'minute').toDate());
    }

    throw e;
  }

  return process.done();
};
