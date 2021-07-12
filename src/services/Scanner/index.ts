import axios, {AxiosInstance} from "axios";

export interface ScannerParams {
  host: string;
  port: number;
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

export interface TransactionReceipt {
  to: string;
  from: string;
  contractAddress: string,
  transactionIndex: number,
  root?: string,
  logsBloom: string,
  blockHash: string,
  transactionHash: string,
  blockNumber: number,
  confirmations: number,
  byzantium: boolean,
  status?: number
}


export class ScannerService {
  protected client: AxiosInstance;
  constructor(scannerParams: ScannerParams) {
    this.client = axios.create({
      baseURL: `${scannerParams.host}:${scannerParams.port}`
    })
  }

  async currentBlock(network: string): Promise<number> {
    try {
      const res = await this.client.get<{ currentBlock: number }>(`/api/eth/${network}/current-block`);
      return Number(res.data.currentBlock);
    } catch {
      return 0;
    }
  }

  async findContract(network: string, address: string): Promise<Contract | undefined> {
    let contracts = (await this.client.get<Contract[]>(`/api/contract?network=${network}&address=${address}`)).data;
    if (contracts.length === 0) {
      return undefined;
    }

    return contracts[0];
  }

  async getContract(id: string): Promise<Contract | undefined> {
    return (await this.client.get<Contract>(`/api/contract/${id}`)).data;
  }

  async registerContract(network: string, address: string, name?: string, startHeight?: number): Promise<Contract> {
    const contract = await this.client.post<Contract>(`/api/contract`, {
      name: name ?? address,
      network,
      address,
      startHeight: startHeight ? startHeight : await this.currentBlock(network) - 10,
      abi: ''
    });

    return contract.data;
  }

  async findListener(contractId: string, event: string): Promise<EventListener | undefined> {
    let eventListeners = (await this.client.get<EventListener[]>(`/api/contract/${
      contractId}/event-listener?name=${event}`)).data;
    if (eventListeners.length === 0) {
      return undefined;
    }

    return eventListeners[0];
  }

  async registerListener(contractId: string, event: string, syncHeight: number = 0): Promise<EventListener> {
    const contract = await this.getContract(contractId);
    if (!contract) {
      throw new Error('Contract has not found');
    }

    const eventListener = await this.client.post<EventListener>(`/api/contract/${contractId}/event-listener`, {
      name: event,
      syncHeight: syncHeight || await this.currentBlock(contract.network) - 10,
    });

    return eventListener.data;
  }


  async registerCallback(network: string, address: string, event: string, callBackUrl: string): Promise<CallBack> {
    let contract = await this.findContract(network, address);
    if (!contract) {
      contract = await this.registerContract(network, address);
    }

    let listener = await this.findListener(contract.id, event);
    if (!listener) {
      listener = await this.registerListener(contract.id, event);
    }

    return (await this.client.post<CallBack>(`/api/contract/${
      contract.id}/event-listener/${listener.id}/call-back`, {
        callBackUrl
    })).data;
  }

  async getContractsAddressByUserAddress(networkId: string, address: string): Promise<string[]> {
    return (await this.client.get<string[]>(`/api/address/${address}?networkId=${networkId}`)).data;
  }

}

export function scannerServiceFactory(scannerParams: ScannerParams) {
  return () => new ScannerService(scannerParams);
}
