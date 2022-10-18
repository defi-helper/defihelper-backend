import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';

export default async (process: Process) => {
  await Promise.all([
    container.model
      .metricProtocolTable()
      .where('date', '<', dayjs().add(-90, 'days').toDate())
      .delete(),

    container.model
      .metricContractTable()
      .where('date', '<', dayjs().add(-90, 'days').toDate())
      .delete(),
    container.model
      .metricContractRegistryTable()
      .where('date', '<', dayjs().add(-90, 'days').toDate())
      .delete(),

    container.model
      .metricWalletTable()
      .where('date', '<', dayjs().add(-90, 'days').toDate())
      .delete(),
    container.model
      .metricWalletRegistryTable()
      .where('date', '<', dayjs().add(-90, 'days').toDate())
      .delete(),

    container.model
      .metricWalletTokenTable()
      .where('date', '<', dayjs().add(-90, 'days').toDate())
      .delete(),
    container.model
      .metricWalletTokenRegistryTable()
      .where('date', '<', dayjs().add(-90, 'days').toDate())
      .delete(),
  ]);

  return process.done();
};
