import { v4 as uuid } from 'uuid';
import { Protocol, Contract } from '@models/Protocol/Entity';
import { Factory } from '@services/Container';
import {
  MetricContractTable,
  MetricMap,
  MetricWalletTable,
  MetricWalletTokenTable,
} from './Entity';
import { Wallet } from '@models/Wallet/Entity';
import axios from 'axios';
import vm from 'vm';

export interface MetricData extends Object {
  metrics?: MetricMap;
}

export interface TokensData {
  [t: string]: MetricMap;
}

export interface WalletData extends MetricData {
  tokens?: TokensData;
}

export interface ContractData extends MetricData {
  wallet?: (wallet: string) => Promise<WalletData>;
}

export interface ContractAdapterOptions {
  blockNumber?: number | string;
}

export interface ContractAdapter {
  (provider: any, contract: string, options: ContractAdapterOptions): Promise<ContractData>;
}

export interface ProtocolAdapter {
  [k: string]: ContractAdapter;
}

export class MetricContractService {
  constructor(
    readonly metricContractTable: Factory<MetricContractTable> = metricContractTable,
    readonly metricWalletTable: Factory<MetricWalletTable> = metricWalletTable,
    readonly metricWalletTokenTable: Factory<MetricWalletTokenTable> = metricWalletTokenTable,
    readonly adapterURL: string = adapterURL,
  ) {}

  async getAdapter(protocol: Protocol): Promise<ProtocolAdapter> {
    const path = `/${protocol.adapter}.js`;

    const adapterResponse = await axios.get(`${this.adapterURL}${path}`);
    const context = vm.createContext({
      module: { exports: new Error('Adapter not evaluated') },
      console,
      axios,
    });
    vm.runInContext(adapterResponse.data, context);

    return context.module.exports;
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

    return created;
  }

  async createToken(
    contract: Contract,
    wallet: Wallet,
    token: string,
    data: MetricMap,
    date: Date,
  ) {
    if (contract.blockchain !== wallet.blockchain || contract.network !== wallet.network) {
      throw new Error('Invalid wallet');
    }

    const created = {
      id: uuid(),
      contract: contract.id,
      wallet: wallet.id,
      token,
      data,
      date,
      createdAt: new Date(),
    };
    await this.metricWalletTokenTable().insert(created);

    return created;
  }
}
