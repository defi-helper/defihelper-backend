import Moralis from 'moralis/node';

export class MoralisService {
  private isMoralisInitialized = false;

  private readonly config: Moralis.StartOptions;

  constructor(config: Moralis.StartOptions) {
    this.config = config;
  }

  async init() {
    if (this.isMoralisInitialized) {
      return;
    }

    await Moralis.start(this.config);
    this.isMoralisInitialized = true;
  }

  async getWeb3API() {
    await this.init();
    return Moralis.Web3API;
  }
}

export function moralisServiceFactory(config: Moralis.StartOptions) {
  return () => new MoralisService(config);
}
