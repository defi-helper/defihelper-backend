import axios, { AxiosError, AxiosInstance } from 'axios';

export class TemporaryOutOfService extends Error {
  constructor(m = 'wait a bit, usually it means that we updating our infrastructure') {
    super(m);
  }
}

export interface WatcherParams {
  host: string;
}

export interface Contract {
  id: string;
  address: string;
  network: string;
  name: string;
  abi: Array<any>;
  startHeight: number;
  updatedAt: Date;
  createdAt: Date;
}

export interface ContractStatistics {
  uniqueWalletsCount: number;
}

export interface ContractStatisticsQuery {
  filter: {
    date?: {
      from: Date;
      to: Date;
    };
    block?: {
      from: number;
      to: number;
    };
  };
}

export interface EventListener {
  id: string;
  contract: string;
  name: string;
  syncHeight: number;
  updatedAt: Date;
  createdAt: Date;
}

export interface CallBack {
  id: string;
  eventListener: string;
  callbackUrl: string;
  createdAt: Date;
}

export interface WalletsInteractedWith {
  [wallet: string]: { [network: string]: string[] };
}

export class WatcherService {
  protected client: AxiosInstance;

  constructor(watcherParams: WatcherParams) {
    this.client = axios.create({
      baseURL: watcherParams.host,
    });
  }

  async findContract(network: string, address: string): Promise<Contract | undefined> {
    const contracts = (
      await this.client
        .get<Contract[]>(`/api/contract?network=${network}&address=${address.toLowerCase()}`)
        .catch((e) => {
          if (e.response?.code === 503) throw new TemporaryOutOfService();
          throw new Error(`Undefined error in watcher: ${e.message}`);
        })
    ).data;
    if (contracts.length === 0) {
      return undefined;
    }

    return contracts[0];
  }

  getContract(id: string): Promise<Contract | null> {
    return this.client
      .get<Contract>(`/api/contract/${id}`)
      .then(({ data }) => data)
      .catch((e: AxiosError) => {
        if (e.response?.status === 404) return null;
        throw e;
      });
  }

  getContractByFid(fid: string): Promise<Contract | null> {
    return this.client
      .get<Contract>(`/api/contract/fid/${fid}`)
      .then(({ data }) => data)
      .catch((e: AxiosError) => {
        if (e.response?.status === 404) return null;
        throw e;
      });
  }

  async getContractStatistics(id: string): Promise<ContractStatistics> {
    const res = await this.client
      .get<ContractStatistics>(`/api/contract/${id}/statistics`)
      .catch((e) => {
        if (e.response?.code === 503) throw new TemporaryOutOfService();
        throw new Error(`Undefined error in watcher: ${e.message}`);
      });

    return res.data;
  }

  async registerContract(
    network: string,
    address: string,
    abi: object,
    name?: string,
    startHeight?: number,
    fid?: string,
  ): Promise<Contract> {
    const contract = await this.client
      .post<Contract>(`/api/contract`, {
        name: name ?? address.toLowerCase(),
        network,
        address: address.toLowerCase(),
        startHeight: startHeight || (await this.currentBlock(network)) - 10,
        abi: JSON.stringify(abi),
        fid: fid ?? '',
      })
      .catch((e) => {
        if (e.response?.code === 503) throw new TemporaryOutOfService();
        throw new Error(`Undefined error in watcher: ${e.message}`);
      });

    return contract.data;
  }

  updateContract(
    id: string,
    state: {
      network?: string;
      address?: string;
      abi?: object;
      name?: string;
      startHeight?: number;
      fid?: string;
    },
  ) {
    return this.client
      .put<Contract>(`/api/contract/${id}`, state)
      .then(({ data }) => data)
      .catch((e) => {
        if (e.response?.code === 503) throw new TemporaryOutOfService();
        throw new Error(`Undefined error in watcher: ${e.message}`);
      });
  }

  async getContractsAddressByUserAddress(networkId: string, address: string): Promise<string[]> {
    return (
      await this.client.get<string[]>(
        `/api/address/${address.toLowerCase()}?networkId=${networkId}`,
      )
    ).data;
  }

  async getWalletsInteractedContracts(walletList: string[]): Promise<WalletsInteractedWith> {
    return (await this.client.post<WalletsInteractedWith>('/api/address/bulk', walletList)).data;
  }
}

export function watcherServiceFactory(watcherParams: WatcherParams) {
  return () => new WatcherService(watcherParams);
}
