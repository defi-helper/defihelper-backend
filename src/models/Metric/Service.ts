import container from '@container';
import Knex from 'knex';
import { v4 as uuid } from 'uuid';
import { Blockchain } from '@models/types';
import { Emitter } from '@services/Event';
import { Protocol, Contract } from '@models/Protocol/Entity';
import { Factory } from '@services/Container';
import { Wallet } from '@models/Wallet/Entity';
import { Token } from '@models/Token/Entity';
import { Task } from '@models/Queue/Entity';
import {
  MetricBlockchain,
  MetricBlockchainTable,
  MetricContract,
  MetricContractTable,
  MetricContractTask,
  MetricContractTaskTable,
  MetricWalletTask,
  MetricWalletTaskTable,
  MetricMap,
  MetricProtocol,
  MetricProtocolTable,
  MetricToken,
  MetricTokenTable,
  MetricWallet,
  MetricWalletTable,
  MetricWalletToken,
  MetricWalletTokenTable,
  MetricWalletRegistryTable,
  metricWalletRegistryTableName,
  MetricWalletTokenRegistryTable,
} from './Entity';

export class MetricContractService {
  public readonly onWalletCreated = new Emitter<MetricWallet>(async (metric) =>
    container.cache().publish(
      'defihelper:channel:onWalletMetricUpdated',
      JSON.stringify({
        id: metric.id,
        wallet: metric.wallet,
        contract: metric.contract,
      }),
    ),
  );

  public readonly onWalletTokenCreated = new Emitter<MetricWalletToken>(async (metric) => {
    container.cache().publish(
      'defihelper:channel:onWalletTokenMetricUpdated',
      JSON.stringify({
        id: metric.id,
        wallet: metric.wallet,
        contract: metric.contract,
        token: metric.token,
      }),
    );
  });

  constructor(
    readonly database: Factory<Knex>,
    readonly metricBlockchainTable: Factory<MetricBlockchainTable>,
    readonly metricProtocolTable: Factory<MetricProtocolTable>,
    readonly metricContractTable: Factory<MetricContractTable>,
    readonly metricContractTaskTable: Factory<MetricContractTaskTable>,
    readonly metricWalletTable: Factory<MetricWalletTable>,
    readonly metricWalletRegistryTable: Factory<MetricWalletRegistryTable>,
    readonly metricWalletTaskTable: Factory<MetricWalletTaskTable>,
    readonly metricWalletTokenTable: Factory<MetricWalletTokenTable>,
    readonly metricWalletTokenRegistryTable: Factory<MetricWalletTokenRegistryTable>,
    readonly metricTokenTable: Factory<MetricTokenTable>,
  ) {}

  async createBlockchain(blockchain: Blockchain, network: string, data: MetricMap, date: Date) {
    const created: MetricBlockchain = {
      id: uuid(),
      blockchain,
      network,
      data,
      date,
      createdAt: new Date(),
    };
    await this.metricBlockchainTable().insert(created);

    return created;
  }

  async createProtocol(protocol: Protocol, data: MetricMap, date: Date) {
    const created: MetricProtocol = {
      id: uuid(),
      protocol: protocol.id,
      data,
      date,
      createdAt: new Date(),
    };
    await this.metricProtocolTable().insert(created);

    return created;
  }

  async createContract(contract: Contract, data: MetricMap, date: Date) {
    const created: MetricContract = {
      id: uuid(),
      contract: contract.id,
      data,
      date,
      createdAt: new Date(),
    };
    await this.metricContractTable().insert(created);

    return created;
  }

  async setContractTask(contract: Contract, task: Task) {
    const duplicate = await this.metricContractTaskTable().where('contract', contract.id).first();
    if (duplicate) {
      const updated: MetricContractTask = {
        ...duplicate,
        task: task.id,
        createdAt: new Date(),
      };
      await this.metricContractTaskTable().where('id', updated.id).update(updated);

      return updated;
    }

    const created: MetricContractTask = {
      id: uuid(),
      contract: contract.id,
      task: task.id,
      createdAt: new Date(),
    };
    await this.metricContractTaskTable().insert(created);

    return created;
  }

  async createWallet(contract: Contract, wallet: Wallet, data: MetricMap, date: Date) {
    const created: MetricWallet = {
      id: uuid(),
      contract: contract.id,
      wallet: wallet.id,
      data,
      date,
      createdAt: new Date(),
    };
    const registryDuplicate = await this.metricWalletRegistryTable()
      .where({
        contract: created.contract,
        wallet: created.wallet,
      })
      .first();
    await this.database().transaction(async (trx) =>
      Promise.all([
        this.metricWalletTable().insert(created).transacting(trx),
        !registryDuplicate || registryDuplicate.date < date
          ? this.metricWalletRegistryTable()
              .insert({
                id: uuid(),
                contract: created.contract,
                wallet: created.wallet,
                data: created.data,
                date: created.date,
              })
              .onConflict(['contract', 'wallet'])
              .merge()
              .transacting(trx)
          : null,
      ]),
    );

    this.onWalletCreated.emit(created);

    return created;
  }

  async walletRegistrySync() {
    return this.database().raw(
      `insert into "${metricWalletRegistryTableName}"
      ${
        this.metricWalletTable()
          .columns('contract', 'wallet', 'data', 'date')
          .distinctOn('contract', 'wallet')
          .orderBy('contract')
          .orderBy('wallet')
          .orderBy('date', 'desc')
          .toSQL().sql
      }
      on conflict ("contract", "wallet") do update set "data" = excluded."data", "date" = excluded."date"`,
    );
  }

  async setWalletTask(contract: Contract, wallet: Wallet, task: Task) {
    const duplicate = await this.metricWalletTaskTable()
      .where({ contract: contract.id, wallet: wallet.id })
      .first();
    if (duplicate) {
      const updated: MetricWalletTask = {
        ...duplicate,
        task: task.id,
        createdAt: new Date(),
      };
      await this.metricWalletTaskTable().where('id', updated.id).update(updated);

      return updated;
    }

    const created: MetricWalletTask = {
      id: uuid(),
      contract: contract.id,
      wallet: wallet.id,
      task: task.id,
      createdAt: new Date(),
    };
    await this.metricWalletTaskTable().insert(created);

    return created;
  }

  async createWalletToken(
    contract: Contract | null,
    wallet: Wallet,
    token: Token,
    data: MetricMap,
    date: Date,
  ) {
    const created: MetricWalletToken = {
      id: uuid(),
      contract: contract ? contract.id : null,
      wallet: wallet.id,
      token: token.id,
      data,
      date,
      createdAt: new Date(),
    };
    await this.database().transaction(async (trx) =>
      Promise.all([
        this.metricWalletTokenTable().insert(created).transacting(trx),
        this.updateWalletTokenRegistry(created, trx),
      ]),
    );

    this.onWalletTokenCreated.emit(created);

    return created;
  }

  async updateWalletTokenRegistry(metric: MetricWalletToken, trx?: Knex.Transaction<any, any>) {
    const duplicate = await this.metricWalletTokenRegistryTable()
      .where({
        contract: metric.contract,
        wallet: metric.wallet,
        token: metric.token,
      })
      .first();
    if (!duplicate) {
      const query = this.metricWalletTokenRegistryTable()
        .insert({
          id: uuid(),
          contract: metric.contract,
          wallet: metric.wallet,
          token: metric.token,
          data: metric.data,
          date: metric.date,
        })
        .onConflict(['contract', 'wallet', 'token'])
        .ignore();
      if (trx) query.transacting(trx);
      return query;
    }
    if (duplicate.date < metric.date) {
      const query = this.metricWalletTokenRegistryTable()
        .update({
          data: metric.data,
          date: metric.date,
        })
        .where('id', duplicate.id);
      if (trx) query.transacting(trx);
      return query;
    }
    return null;
  }

  async createToken(token: Token, data: MetricMap, date: Date) {
    const created: MetricToken = {
      id: uuid(),
      token: token.id,
      data,
      date,
      createdAt: new Date(),
    };
    await this.metricTokenTable().insert(created);

    return created;
  }
}
