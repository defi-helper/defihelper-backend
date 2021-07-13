import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';
import { ethers } from 'ethers';

export interface Params {
  contract: string;
  wallet: string;
  blockNumber: string;
}

export default async (process: Process) => {
  const { contract: contractId, wallet: walletId, blockNumber } = process.task.params as Params;
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
  const protocolAdapter = await metricService.getAdapter(protocol);
  const contractAdapterFactory = protocolAdapter[contract.adapter];
  if (contractAdapterFactory === undefined) throw new Error('Contract adapter not found');

  const blockchain = container.blockchain[contract.blockchain];
  const provider = blockchain.byNetwork(contract.network).provider();

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

  const tokenService = container.model.tokenService();
  if (
    typeof walletAdapterData.tokens === 'object' &&
    Object.keys(walletAdapterData.tokens).length > 0
  ) {
    await Promise.all(
      Object.entries(walletAdapterData.tokens).map(async ([tokenAddress, metric]) => {
        await metricService.createToken(contract, wallet, tokenAddress, metric, date);

        const tokenDuplicate = await tokenService
          .table()
          .where({
            blockchain: wallet.blockchain,
            network: wallet.network,
            address: tokenAddress,
          })
          .first();
        if (!tokenDuplicate) {
          await tokenService.create(
            null,
            wallet.blockchain,
            wallet.network,
            tokenAddress,
            '',
            '',
            0,
          );
        }
      }),
    );
  }

  return process.done();
};
