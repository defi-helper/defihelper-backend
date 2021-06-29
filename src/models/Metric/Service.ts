import { v4 as uuid } from 'uuid';
import { Protocol, Contract } from '@models/Protocol/Entity';
import { Factory } from '@services/Container';
import { MetricContractTable, MetricMap, MetricWalletTable } from './Entity';
import { Wallet } from '@models/Wallet/Entity';
import axios from 'axios';
import vm from 'vm';

export interface MetricAdapter {
  contract?: (provider: any, contract: string) => Promise<MetricMap>;
  wallet?: (provider: any, contract: string, wallet: string) => Promise<MetricMap>;
}

export interface Adapter {
  metrics?: {
    [t: string]: MetricAdapter;
  };
}

export class MetricContractService {
  constructor(
    readonly metricContractTable: Factory<MetricContractTable> = metricContractTable,
    readonly metricWalletTable: Factory<MetricWalletTable> = metricWalletTable,
    readonly adapterURL: string = adapterURL,
  ) {}

  async getAdapter(protocol: Protocol): Promise<Adapter | Error> {
    const path = `/${protocol.adapter}.js`;

    try {
      const adapterResponse = await axios.get(`${this.adapterURL}${path}`);
      if (adapterResponse.status !== 200) return new Error(adapterResponse.statusText);

      const context = vm.createContext({
        module: { exports: new Error('Adapter not evaluated') },
        console,
        axios,
      });
      vm.runInContext(adapterResponse.data, context);

      return context.module.exports;
    } catch (e) {
      return e;
    }
  }

  async createContract(contract: Contract, data: MetricMap) {
    const created = {
      id: uuid(),
      contract: contract.id,
      data,
      createdAt: new Date(),
    };
    await this.metricContractTable().insert(created);

    return created;
  }

  async createWallet(contract: Contract, wallet: Wallet, data: MetricMap) {
    if (contract.blockchain !== wallet.blockchain || contract.network !== wallet.network) {
      throw new Error('Invalid wallet');
    }

    const created = {
      id: uuid(),
      contract: contract.id,
      wallet: wallet.id,
      data,
      createdAt: new Date(),
    };
    await this.metricWalletTable().insert(created);

    return created;
  }
}
