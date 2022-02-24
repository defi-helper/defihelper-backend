import container from '@container';
import { Process } from '@models/Queue/Entity';
import { Token, TokenCreatedBy } from '@models/Token/Entity';
import dayjs from 'dayjs';
import { ethers } from 'ethers';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import * as Adapters from '@services/Blockchain/Adapter';
import { Contract, TokenContractLinkType } from '@models/Protocol/Entity';

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

async function registerToken(
  contract: Contract,
  date: Date,
  tokenData: Adapters.ContractTokenData,
  linkType: TokenContractLinkType | null,
  parent: Token | null,
) {
  const token = await getOrCreateToken(
    contract,
    contract.blockchain === 'ethereum' ? tokenData.address.toLowerCase() : tokenData.address,
  );

  await Promise.all([
    linkType !== null
      ? container.model.contractService().tokenLink(contract, [{ token, type: linkType }])
      : null,
    parent !== null ? container.model.tokenService().part(parent, [token]) : null,
    container.model.metricService().createToken(token, { usd: tokenData.priceUSD }, date),
  ]);

  await Promise.all(
    (tokenData.parts ?? []).map((tokenPartData) =>
      registerToken(contract, date, tokenPartData, null, token),
    ),
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

    if (contractAdapterData.stakeToken) {
      await registerToken(
        contract,
        date,
        contractAdapterData.stakeToken,
        TokenContractLinkType.Stake,
        null,
      );
    }
    if (contractAdapterData.rewardToken) {
      await registerToken(
        contract,
        date,
        contractAdapterData.rewardToken,
        TokenContractLinkType.Reward,
        null,
      );
    }
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
