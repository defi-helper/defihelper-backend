import container from '@container';
import { Process } from '@models/Queue/Entity';
import { TokenCreatedBy } from '@models/Token/Entity';
import dayjs from 'dayjs';
import { ethers } from 'ethers';

export interface ContractMetricsParams {
  contract: string;
  blockNumber: string;
}

export async function contractMetrics(process: Process) {
  const { contract: contractId, blockNumber } = process.task.params as ContractMetricsParams;
  const contract = await container.model.contractTable().where('id', contractId).first();
  if (!contract) throw new Error('Contract not found');

  const protocol = await container.model.protocolTable().where('id', contract.protocol).first();
  if (!protocol) throw new Error('Protocol not found');

  const metricService = container.model.metricService();
  const protocolAdapters = await container.blockchainAdapter.loadAdapter(protocol.adapter);
  const contractAdapterFactory = protocolAdapters[contract.adapter];
  if (typeof contractAdapterFactory !== 'function') throw new Error('Contract adapter not found');

  const blockchain = container.blockchain[contract.blockchain];
  const network = blockchain.byNetwork(contract.network);
  const provider = blockNumber === 'latest' ? network.provider() : network.providerHistorical();

  let date = new Date();
  if (provider instanceof ethers.providers.JsonRpcProvider && blockNumber !== 'latest') {
    const block = await provider.getBlock(parseInt(blockNumber, 10));
    date = dayjs.unix(block.timestamp).toDate();
  }

  const contractAdapterData = await contractAdapterFactory(provider, contract.address, {
    blockNumber,
  });
  if (
    typeof contractAdapterData.metrics === 'object' &&
    Object.keys(contractAdapterData.metrics).length > 0
  ) {
    await metricService.createContract(contract, contractAdapterData.metrics, date);
  }

  return process.done();
}

export interface WalletMetricsParams {
  contract: string;
  wallet: string;
  blockNumber: string;
}

export async function walletMetrics(process: Process) {
  const {
    contract: contractId,
    wallet: walletId,
    blockNumber,
  } = process.task.params as WalletMetricsParams;
  const contract = await container.model.contractTable().where('id', contractId).first();
  if (!contract) throw new Error('Contract not found');

  const protocol = await container.model.protocolTable().where('id', contract.protocol).first();
  if (!protocol) throw new Error('Protocol not found');

  const wallet = await container.model.walletTable().where('id', walletId).first();
  if (!wallet) throw new Error('Wallet not found');
  if (wallet.blockchain !== contract.blockchain || wallet.network !== contract.network) {
    throw new Error('Invalid blockchain');
  }

  const metricService = container.model.metricService();
  const protocolAdapter = await container.blockchainAdapter.loadAdapter(protocol.adapter);
  const contractAdapterFactory = protocolAdapter[contract.adapter];
  if (typeof contractAdapterFactory !== 'function') throw new Error('Contract adapter not found');

  const blockchain = container.blockchain[contract.blockchain];
  const network = blockchain.byNetwork(contract.network);
  const provider = blockNumber === 'latest' ? network.provider() : network.providerHistorical();

  let date = new Date();
  if (provider instanceof ethers.providers.JsonRpcProvider && blockNumber !== 'latest') {
    const block = await provider.getBlock(parseInt(blockNumber, 10));
    if (block === null) throw new Error('Invalid block number');
    date = dayjs.unix(block.timestamp).toDate();
  }

  const contractAdapterData = await contractAdapterFactory(provider, contract.address, {
    blockNumber,
  });
  if (!contractAdapterData.wallet) return process.done();

  const walletAdapterData = await contractAdapterData.wallet(wallet.address);
  if (
    typeof walletAdapterData.metrics === 'object' &&
    Object.keys(walletAdapterData.metrics).length > 0
  ) {
    await metricService.createWallet(contract, wallet, walletAdapterData.metrics, date);
  }

  if (
    typeof walletAdapterData.tokens === 'object' &&
    Object.keys(walletAdapterData.tokens).length > 0
  ) {
    await Promise.all(
      Object.entries(walletAdapterData.tokens).map(async ([tokenAddress, metric]) => {
        let address = tokenAddress;
        if (contract.blockchain === 'ethereum') {
          address = tokenAddress.toLowerCase();
        }

        let token = await container.model
          .tokenTable()
          .where({
            blockchain: contract.blockchain,
            network: contract.network,
            address,
          })
          .first();
        if (!token) {
          token = await container.model
            .tokenService()
            .create(
              null,
              contract.blockchain,
              contract.network,
              address,
              '',
              '',
              0,
              TokenCreatedBy.Adapter,
            );
        }

        await metricService.createToken(contract, wallet, token, metric, date);
      }),
    );
  }

  return process.done();
}
