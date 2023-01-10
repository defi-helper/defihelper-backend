import container from '@container';
import {
  Contract,
  contractBlockchainTableName,
  ContractBlockchainType,
  contractTableName,
  protocolTableName,
} from '@models/Protocol/Entity';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const db = container.database();
  const contracts = await container.model
    .contractTable()
    .column(`${contractTableName}.*`)
    .column(`${contractBlockchainTableName}.*`)
    .column<Array<Contract & ContractBlockchainType & { protocolAdapter: string }>>(
      `${protocolTableName}.adapter as protocolAdapter`,
    )
    .innerJoin(
      contractBlockchainTableName,
      `${contractBlockchainTableName}.id`,
      `${contractTableName}.id`,
    )
    .innerJoin(protocolTableName, `${protocolTableName}.id`, `${contractTableName}.protocol`)
    .where(db.raw(`${contractBlockchainTableName}.automate->>'autorestakeAdapter' IS NOT NULL`));

  await container.model
    .contractTable()
    .update('invest', true)
    .whereIn(
      'id',
      contracts
        .filter((contract) => {
          return contract.protocolAdapter === 'uniswap3' || contract.automate.lpTokensManager;
        })
        .map(({ id }) => id),
    );

  return process.done();
};
