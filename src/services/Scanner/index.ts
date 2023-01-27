import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export class TemporaryOutOfService extends Error {
  constructor(
    m = 'wait a bit, usually it means that we updating our infrastructure',
    public readonly reason: AxiosResponse,
  ) {
    super(m);
  }
}

export interface Contract {
  id: string;
  name: string;
  address: string;
  network: number;
  abi: Array<any>;
  startHeight: number;
  updatedAt: Date;
  createdAt: Date;
}

export interface ContractConfig {
  name?: string;
  network?: string | number;
  address?: string;
  abi?: object;
  startHeight?: string | number;
  enabled?: boolean;
}

export function prepareContractConfig({
  name,
  network,
  address,
  abi,
  startHeight,
  enabled,
}: ContractConfig) {
  const networkNormal = network !== undefined ? Number(network) : undefined;
  const addressNormal = address !== undefined ? address.toLowerCase() : undefined;
  const startHeightNormal = startHeight !== undefined ? Number(startHeight) : undefined;

  return {
    name,
    network: networkNormal,
    address: addressNormal,
    abi,
    startHeight: startHeightNormal,
    enabled,
  };
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

export interface EventListenerConfig {
  promptly?: {} | null;
}

export interface HistoryScanner {
  id: string;
  eventListener: string;
  syncHeight: number;
  endHeight: number | null;
  saveEvents: boolean;
}

export interface HistoryScannerConfig {
  syncHeight: string | number;
  endHeight: string | number | null;
  saveEvents: boolean;
}

export function prepareHistoryScannerConfig({
  syncHeight,
  endHeight,
  saveEvents,
}: HistoryScannerConfig) {
  const syncHeightNormal = Number(syncHeight);
  const endHeightNormal = endHeight !== null ? Number(endHeight) : null;
  if (Number.isNaN(syncHeightNormal)) {
    throw new Error(`Sync height is NaN "${syncHeightNormal}"`);
  }
  if (Number.isNaN(endHeightNormal)) {
    throw new Error(`End height is NaN "${endHeightNormal}"`);
  }
  return {
    syncHeight: syncHeightNormal,
    endHeight: endHeightNormal,
    saveEvents,
  };
}

export interface WalletInteraction {
  network: string;
  contract: string;
  event: string;
}

export interface WalletsInteractedWith {
  [wallet: string]: { [network: string]: string[] };
}

const handleResponse = <T>(r: Promise<AxiosResponse<T>>) =>
  r
    .then(({ data }) => data)
    .catch((e) => {
      if (!axios.isAxiosError(e) || !e.response) {
        throw new Error(`Undefined error in scanner: ${e}`);
      }
      if (e.response.status >= 400 && e.response.status <= 599) {
        const request = e.request ? `${e.request.method} ${e.request.path} ` : '';
        throw new TemporaryOutOfService(
          `${request}${e.response.status} ${e.response.data}`,
          e.response,
        );
      }

      throw new Error(`Undefined error in scanner: ${e.message}`);
    });

type Id<T extends { id: string }> = T | string;

const id = <T extends { id: string }>(instance: Id<T>) =>
  typeof instance === 'string' ? instance : instance.id;

export class ScannerService {
  protected client: AxiosInstance;

  constructor(scannerParams: { host: string }) {
    this.client = axios.create({
      baseURL: scannerParams.host,
    });
  }

  protected request<T>(config: AxiosRequestConfig): Promise<T> {
    return handleResponse(this.client.request<T>(config));
  }

  findContract(network: string, address: string) {
    return this.request<Contract[]>({
      method: 'GET',
      url: `/api/contract?network=${network}&address=${address.toLowerCase()}`,
    }).then((data) => (data.length > 0 ? data[0] : undefined));
  }

  getContract(contractId: string) {
    return this.request<Contract>({
      method: 'GET',
      url: `/api/contract/${contractId}`,
    }).catch((e) => {
      if (e instanceof TemporaryOutOfService && e.reason.status === 404) {
        return null;
      }
      throw e;
    });
  }

  getContractStatistics(contract: Id<Contract>) {
    return this.request<ContractStatistics>({
      method: 'GET',
      url: `/api/contract/${id(contract)}/statistics`,
    }).catch((e) => {
      if (e instanceof TemporaryOutOfService && e.reason.status === 404) {
        return { uniqueWalletsCount: 0 };
      }
      throw e;
    });
  }

  registerContract(
    network: string | number,
    address: string,
    abi: object,
    name?: string,
    startHeight?: number | string,
  ) {
    const networkNormal = Number(network);
    const startHeightNormal = Number(startHeight ?? 0);
    const addressNormal = address.toLowerCase();
    const nameNormal = name ?? address;
    if (Number.isNaN(networkNormal)) {
      throw new Error(`Network is NaN "${networkNormal}"`);
    }
    if (Number.isNaN(startHeightNormal)) {
      throw new Error(`Start height is NaN "${networkNormal}"`);
    }
    if (nameNormal === '') {
      throw new Error('Name is empty');
    }

    return this.request<Contract>({
      method: 'POST',
      url: '/api/contract',
      data: {
        name: nameNormal,
        network: networkNormal,
        address: addressNormal,
        startHeight: startHeightNormal,
        abi: JSON.stringify(abi),
        enabled: true,
      },
    });
  }

  updateContract(contract: Id<Contract>, data: ContractConfig) {
    return this.request<Contract>({
      method: 'PUT',
      url: `/api/contract/${id(contract)}`,
      data: prepareContractConfig(data),
    });
  }

  findListener(contract: Id<Contract>, event: string) {
    return this.request<EventListener[]>({
      method: 'GET',
      url: `/api/contract/${id(contract)}/event-listener?name=${event}`,
    }).then((data) => (data.length > 1 ? data[0] : undefined));
  }

  async registerListener(contract: Id<Contract>, event: string, config?: EventListenerConfig) {
    const listener = await this.request<EventListener>({
      method: 'POST',
      url: `/api/contract/${id(contract)}/event-listener`,
      data: { name: event },
    });
    if (config) {
      await this.updateListener(contract, listener, config);
    }

    return listener;
  }

  /**
   * @param contract
   * @param listener
   * @param data Null for delete sync.
   */
  updateListener(contract: Id<Contract>, listener: Id<EventListener>, data: EventListenerConfig) {
    return this.request<boolean>({
      method: 'PUT',
      url: `/api/contract/${id(contract)}/event-listener/${id(listener)}`,
      data,
    });
  }

  createHistoryScanner(
    contract: Id<Contract>,
    listener: Id<EventListener>,
    data: HistoryScannerConfig,
  ) {
    return this.request<HistoryScanner>({
      method: 'POST',
      url: `/api/contract/${id(contract)}/event-listener/${id(listener)}/history`,
      data: prepareHistoryScannerConfig(data),
    });
  }

  updateHistoryScanner(
    contract: Id<Contract>,
    listener: Id<EventListener>,
    historyScanner: Id<HistoryScanner>,
    data: HistoryScannerConfig,
  ) {
    return this.request<HistoryScanner>({
      method: 'PUT',
      url: `/api/contract/${id(contract)}/event-listener/${id(listener)}/history/${id(
        historyScanner,
      )}`,
      data: prepareHistoryScannerConfig(data),
    });
  }

  getWalletInteractions(network: string, address: string) {
    return this.request<WalletInteraction[]>({
      method: 'GET',
      url: `/api/address/${address.toLowerCase()}?network=${network}`,
    });
  }

  getWalletsInteractedContracts(walletList: string[]) {
    return this.request<WalletsInteractedWith>({
      method: 'POST',
      url: '/api/address/bulk',
      data: walletList,
    });
  }
}
