import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';

export interface Params {
  contract: string;
  date: {
    from: number;
    to: number;
  };
}

export default async (process: Process) => {
  const {
    contract: contractId,
    date: { from, to },
  } = process.task.params as Params;

  const contract = await container.model.contractTable().where('id', contractId).first();
  if (!contract) throw new Error('Contract not found');
  if (contract.blockchain !== 'ethereum') {
    return process.info('No ethereum').done();
  }

  const scanner = container.scanner();
  const scannerContract = await scanner.findContract(contract.network, contract.address);
  if (!scannerContract) {
    throw new Error('Contract not registered on scanner');
  }

  const { uniqueWalletsCount } = await scanner.getContractStatistics(scannerContract.id, {
    filter: {
      date: {
        from: dayjs.unix(from).toDate(),
        to: dayjs.unix(to).toDate(),
      },
    },
  });

  await container.model.metricService().createContract(
    contract,
    {
      uniqueWalletsCount: uniqueWalletsCount.toString(),
    },
    dayjs.unix(to).toDate(),
  );

  return process.done();
};
