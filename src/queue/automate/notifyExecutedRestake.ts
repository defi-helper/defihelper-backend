import container from '@container';
import { Process } from '@models/Queue/Entity';
import {
  walletBlockchainTableName,
  walletExchangeTableName,
  walletTableName,
} from '@models/Wallet/Entity';

export interface Params {
  contract: string;
}

export default async (process: Process) => {
  const { contract } = process.task.params as Params;

  const [contract, walletsExchange] = await Promise.all([
    container.model.automateContractTable().where('id', contract).first(),
    container.model
      .walletTable()
      .innerJoin(walletExchangeTableName, `${walletExchangeTableName}.id`, `${walletTableName}.id`)
      .where(`${walletTableName}.user`, user),
  ]);

  return process.done();
};
