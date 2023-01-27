import container from '@container';
import { Contract, contractTableName, protocolTableName } from '@models/Protocol/Entity';

export default () => {
  const queue = container.model.queueService();
  return container.model
    .contractTable()
    .column<Contract[]>(`${contractTableName}.*`)
    .innerJoin(protocolTableName, `${protocolTableName}.id`, `${contractTableName}.protocol`)
    .where(`${protocolTableName}.adapter`, 'uniswap3')
    .then((contracts) =>
      contracts.reduce<Promise<unknown>>(
        (prev, { id: contract }) =>
          prev.then(() => queue.push('registerContractInScanner', { contract, events: ['Swap'] })),
        Promise.resolve(null),
      ),
    );
};
