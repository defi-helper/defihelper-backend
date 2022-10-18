import { ethers } from 'ethers';

export namespace EthereumEventsScan {
  export interface EventsScanParams {
    contract: ethers.Contract;
    from: number;
    step: number;
    lag?: number;
  }

  export class Scanner {
    constructor(public readonly params: EventsScanParams) {}

    public currentBlockNumberWithLag: Promise<number> = new Promise((resolve, reject) => {
      return this.params.contract.provider
        .getBlockNumber()
        .then((v) => Number(v.toString()))
        .then((currentBlockNumber) => {
          if (Number.isNaN(currentBlockNumber)) {
            return reject(new Error(`Invalid block number: "${currentBlockNumber}"`));
          }
          return resolve(currentBlockNumber - (this.params.lag ?? 0));
        });
    });

    public to: Promise<number> = new Promise((resolve) => {
      return this.currentBlockNumberWithLag.then((currentBlockNumber) => {
        const to = this.params.from + this.params.step;
        return resolve(to > currentBlockNumber ? currentBlockNumber : to);
      });
    });

    async getEvents(eventFilter: ethers.EventFilter) {
      if ((await this.currentBlockNumberWithLag) < this.params.from) {
        return [];
      }

      return this.params.contract.queryFilter(eventFilter, this.params.from, await this.to);
    }
  }

  export const useEventsScan = (params: EventsScanParams) => {
    return new Scanner(params);
  };
}
