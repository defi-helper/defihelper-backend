import axios, { AxiosError, AxiosInstance } from 'axios';

export class TemporaryOutOfService extends Error {
  constructor(m = 'wait a bit, usually it means that we updating our infrastructure') {
    super(m);
  }
}

export interface ScannerParams {
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

export interface EventListener {
  id: string;
  contract: string;
  name: string;
  updatedAt: Date;
  createdAt: Date;
}

export interface WalletsInteractedWith {
  [wallet: string]: { [network: string]: string[] };
}

export class ScannerService {
  static factory = (params: ScannerParams) => () => new ScannerService(params);

  protected client: AxiosInstance;

  constructor(scannerParams: ScannerParams) {
    this.client = axios.create({
      baseURL: scannerParams.host,
    });
  }

  findContract(network: string, address: string): Promise<Contract | undefined> {
    return this.client
      .get<Contract[]>(`/api/contract?network=${network}&address=${address.toLowerCase()}`)
      .catch((e) => {
        if (e.response?.code !== 200) throw new TemporaryOutOfService();
        throw new Error(`Undefined error in scanner: ${e.message}`);
      })
      .then(({ data }) => (data.length > 0 ? data[0] : undefined));
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

  getContractStatistics(id: string): Promise<ContractStatistics> {
    return this.client
      .get<ContractStatistics>(`/api/contract/${id}/statistics`)
      .then(({ data }) => data)
      .catch((e: AxiosError) => {
        if (e.response?.status === 404) {
          return { uniqueWalletsCount: 0 };
        }
        throw e;
      });
  }

  registerContract(
    network: string,
    address: string,
    abi: object,
    name?: string,
    startHeight?: number | string,
  ): Promise<Contract> {
    return this.client
      .post<Contract>(`/api/contract`, {
        name: name ?? address.toLowerCase(),
        network,
        address: address.toLowerCase(),
        startHeight: startHeight ?? 0,
        abi: JSON.stringify(abi),
      })
      .then(({ data }) => data)
      .catch((e) => {
        if (e.response?.code !== 200) throw new TemporaryOutOfService(`${e}`);
        throw new Error(`Undefined error in scanner: ${e.message}`);
      });
  }

  updateContract(
    id: string,
    state: {
      network?: string;
      address?: string;
      abi?: object;
      name?: string;
      startHeight?: number;
    },
  ) {
    return this.client
      .put<Contract>(`/api/contract/${id}`, state)
      .then(({ data }) => data)
      .catch((e) => {
        if (e.response?.code !== 200) throw new TemporaryOutOfService(`${e}`);
        throw new Error(`Undefined error in scanner: ${e.message}`);
      });
  }

  findListener(contractId: string, event: string): Promise<EventListener | undefined> {
    return this.client
      .get<EventListener[]>(`/api/contract/${contractId}/event-listener?name=${event}`)
      .catch((e) => {
        if (e.response?.code !== 200) throw new TemporaryOutOfService(`${e}`);
        throw new Error(`Undefined error in scanner: ${e.message}`);
      })
      .then(({ data }) => (data.length > 0 ? data[0] : undefined));
  }

  async registerListener({ id }: Contract, event: string): Promise<EventListener> {
    return this.client
      .post<EventListener>(`/api/contract/${id}/event-listener`, {
        name: event,
      })
      .then(({ data }) => data)
      .catch((e) => {
        if (e.response?.code !== 200) throw new TemporaryOutOfService(`${e}`);
        throw new Error(`Undefined error in scanner: ${e.message}`);
      });
  }

  getWalletInteractions(network: string, address: string) {
    return this.client
      .get<Array<{ network: string; contract: string; event: string }>>(
        `/api/address/${address.toLowerCase()}?network=${network}`,
      )
      .then(({ data }) => data);
  }

  getWalletsInteractedContracts(walletList: string[]): Promise<WalletsInteractedWith> {
    return this.client
      .post<WalletsInteractedWith>('/api/address/bulk', walletList)
      .then(({ data }) => data);
  }
}
