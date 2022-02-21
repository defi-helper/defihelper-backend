import container from '@container';
import { Process } from '@models/Queue/Entity';
import { TokenCreatedBy } from '@models/Token/Entity';
import dayjs from 'dayjs';
import { ethers } from 'ethers';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import * as Adapters from '@services/Blockchain/Adapter';
import { Contract, TokenContractLinkType } from '@models/Protocol/Entity';

function getLeafTokens(token: Adapters.ContractTokenData): Adapters.ContractTokenData[] {
  return token.parts ? token.parts.flatMap(getLeafTokens) : [token];
}

async function getOrCreateToken(contract: Contract, address: string) {
  const token = await container.model
    .tokenTable()
    .where({
      blockchain: contract.blockchain,
      network: contract.network,
      address,
    })
    .first();
  if (token) return token;

  return container.model
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
  let contractAdapterFactory;
  try {
    const protocolAdapters = await container.blockchainAdapter.loadAdapter(protocol.adapter);
    contractAdapterFactory = protocolAdapters[contract.adapter];
    if (typeof contractAdapterFactory !== 'function') throw new Error('Contract adapter not found');
  } catch (e) {
    if (e instanceof Adapters.TemporaryOutOfService) {
      return process
        .info('postponed due to temporarily service unavailability')
        .later(dayjs().add(5, 'minute').toDate());
    }

    throw e;
  }

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
    await Promise.all([
      metricService.createContract(contract, contractAdapterData.metrics, date),
      container.model.contractService().update({
        ...contract,
        metric: {
          tvl: contractAdapterData.metrics.tvl ?? '0',
          aprDay: contractAdapterData.metrics.aprDay ?? '0',
          aprWeek: contractAdapterData.metrics.aprWeek ?? '0',
          aprMonth: contractAdapterData.metrics.aprMonth ?? '0',
          aprYear: contractAdapterData.metrics.aprYear ?? '0',
        },
      }),
    ]);

    const stakeLeafTokens = (
      contractAdapterData.stakeToken ? getLeafTokens(contractAdapterData.stakeToken) : []
    ).map((tokenData) => ({ ...tokenData, type: TokenContractLinkType.Stake }));
    const rewardLeafTokens = (
      contractAdapterData.rewardToken ? getLeafTokens(contractAdapterData.rewardToken) : []
    ).map((tokenData) => ({ ...tokenData, type: TokenContractLinkType.Reward }));
    const leafTokens = Array.from(
      Object.values(
        [...stakeLeafTokens, ...rewardLeafTokens].reduce<{
          [address: string]: Adapters.ContractTokenData & { type: TokenContractLinkType };
        }>(
          (result, tokenData) => ({
            ...result,
            [tokenData.address.toLowerCase()]: tokenData,
          }),
          {},
        ),
      ),
    );
    const tokenLinks = await Promise.all(
      leafTokens.map(async ({ address: tokenAddress, priceUSD, type }) => {
        let address = tokenAddress;
        if (contract.blockchain === 'ethereum') {
          address = tokenAddress.toLowerCase();
        }
        const token = await getOrCreateToken(contract, address);

        await metricService.createToken(token, { usd: priceUSD }, date);

        return { token, type };
      }),
    );

    await container.model.contractService().tokenLink(contract, tokenLinks);
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

  const blockchainWallet = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where(`${walletTableName}.id`, walletId)
    .first();
  if (!blockchainWallet) throw new Error('Wallet not found');
  if (
    blockchainWallet.blockchain !== contract.blockchain ||
    blockchainWallet.network !== contract.network
  ) {
    throw new Error('Invalid blockchain');
  }

  const metricService = container.model.metricService();
  let contractAdapterFactory;

  try {
    const protocolAdapter = await container.blockchainAdapter.loadAdapter(protocol.adapter);
    contractAdapterFactory = protocolAdapter[contract.adapter];
    if (typeof contractAdapterFactory !== 'function') throw new Error('Contract adapter not found');
  } catch (e) {
    if (e instanceof Adapters.TemporaryOutOfService) {
      return process
        .info('postponed due to temporarily service unavailability')
        .later(dayjs().add(5, 'minute').toDate());
    }

    throw e;
  }

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

  const walletAdapterData = await contractAdapterData.wallet(blockchainWallet.address);
  if (
    typeof walletAdapterData.metrics === 'object' &&
    Object.keys(walletAdapterData.metrics).length > 0
  ) {
    await metricService.createWallet(contract, blockchainWallet, walletAdapterData.metrics, date);
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
        const token = await getOrCreateToken(contract, address);

        await metricService.createWalletToken(contract, blockchainWallet, token, metric, date);
      }),
    );
  }

  return process.done();
}
