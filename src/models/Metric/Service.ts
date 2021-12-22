import container from '@container';
import { v4 as uuid } from 'uuid';
import { Blockchain } from '@models/types';
import { Emitter } from '@services/Event';
import { Protocol, Contract } from '@models/Protocol/Entity';
import { Factory } from '@services/Container';
import { Wallet } from '@models/Wallet/Entity';
import { Token } from '@models/Token/Entity';
import {
  MetricBlockchainTable,
  MetricContractTable,
  MetricMap,
  MetricProtocolTable,
  MetricWallet,
  MetricWalletTable,
  MetricWalletToken,
  MetricWalletTokenTable,
} from './Entity';

export class MetricContractService {
  public readonly onWalletCreated = new Emitter<MetricWallet>(async (metric) => {
    container.cache().publish(
      'defihelper:channel:onWalletMetricUpdated',
      JSON.stringify({
        id: metric.id,
        wallet: metric.wallet,
        contract: metric.contract,
      }),
    );
  });

  public readonly onTokenCreated = new Emitter<MetricWalletToken>(async (metric) => {
    container.cache().publish(
      'defihelper:channel:onTokenMetricUpdated',
      JSON.stringify({
        id: metric.id,
        wallet: metric.wallet,
        contract: metric.contract,
        token: metric.token,
      }),
    );
  });

  constructor(
    readonly metricBlockchainTable: Factory<MetricBlockchainTable>,
    readonly metricProtocolTable: Factory<MetricProtocolTable>,
    readonly metricContractTable: Factory<MetricContractTable>,
    readonly metricWalletTable: Factory<MetricWalletTable>,
    readonly metricWalletTokenTable: Factory<MetricWalletTokenTable>,
  ) {}

  async createBlockchain(blockchain: Blockchain, network: string, data: MetricMap, date: Date) {
    const created = {
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
    const created = {
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
    const created = {
      id: uuid(),
      contract: contract.id,
      data,
      date,
      createdAt: new Date(),
    };
    await this.metricContractTable().insert(created);

    return created;
  }

  async createWallet(contract: Contract, wallet: Wallet, data: MetricMap, date: Date) {
    if (contract.blockchain !== wallet.blockchain || contract.network !== wallet.network) {
      throw new Error('Invalid wallet');
    }

    const created = {
      id: uuid(),
      contract: contract.id,
      wallet: wallet.id,
      data,
      date,
      createdAt: new Date(),
    };
    await this.metricWalletTable().insert(created);
    this.onWalletCreated.emit(created);

    return created;
  }

  async createToken(
    contract: Contract | null,
    wallet: Wallet,
    token: Token,
    data: MetricMap,
    date: Date,
  ) {
    if (contract !== null) {
      if (contract.blockchain !== wallet.blockchain || contract.network !== wallet.network) {
        throw new Error('Invalid wallet');
      }
    }

    const created = {
      id: uuid(),
      contract: contract ? contract.id : null,
      wallet: wallet.id,
      token: token.id,
      data,
      date,
      createdAt: new Date(),
    };
    await this.metricWalletTokenTable().insert(created);
    this.onTokenCreated.emit(created);

    return created;
  }
}
