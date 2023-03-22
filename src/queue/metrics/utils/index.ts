import container from '@container';
import { Process } from '@models/Queue/Entity';
import { Token, TokenCreatedBy } from '@models/Token/Entity';
import dayjs from 'dayjs';
import { ethers } from 'ethers';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import * as Adapters from '@services/Blockchain/Adapter';
import {
  contractBlockchainTableName,
  contractTableName,
  Contract,
  TokenContractLinkType,
  ContractBlockchainType,
} from '@models/Protocol/Entity';
import { apyBoost } from '@services/RestakeStrategy';
import BN from 'bignumber.js';
import { TagType, TagPreservedName, TagTvlType } from '@models/Tag/Entity';
import { RegistryPeriod } from '@models/Metric/Entity';

async function getOrCreateToken(contract: Contract & ContractBlockchainType, address: string) {
  const addressNormalize = contract.blockchain === 'ethereum' ? address.toLowerCase() : address;
  const token = await container.model
    .tokenTable()
    .where({
      blockchain: contract.blockchain,
      network: contract.network,
      address: addressNormalize,
    })
    .first();
  if (token) return token;

  return container.model
    .tokenService()
    .create(
      null,
      contract.blockchain,
      contract.network,
      addressNormalize,
      '',
      '',
      0,
      TokenCreatedBy.Adapter,
    );
}

async function registerToken(
  contract: Contract & ContractBlockchainType,
  date: Date,
  tokenData: Adapters.ContractTokenData,
  linkType: TokenContractLinkType | null,
  parent: Token | null,
) {
  const token = await getOrCreateToken(contract, tokenData.address);

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
  const params = process.task.params as ContractMetricsParams;
  const { contract: contractId } = params;
  const blockNumber = params.blockNumber === 'latest' ? 'latest' : Number(params.blockNumber);
  const contract = await container.model
    .contractTable()
    .innerJoin(
      contractBlockchainTableName,
      `${contractBlockchainTableName}.id`,
      `${contractTableName}.id`,
    )
    .where(`${contractTableName}.id`, contractId)
    .first();
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
    const block = await provider.getBlock(blockNumber);
    if (block === null) throw new Error('Invalid block number');
    date = dayjs.unix(block.timestamp).toDate();
  }

  const contractAdapterData = await contractAdapterFactory(provider, contract.address, {
    blockNumber,
  }).catch(async (e) => {
    if (Adapters.isPriceNotResolvedError(e)) {
      const token = await getOrCreateToken(contract, e.address);
      await container.model.tokenService().update({ ...token, priceFeedNeeded: true });
    }
    throw e;
  });
  if (
    typeof contractAdapterData.metrics === 'object' &&
    Object.keys(contractAdapterData.metrics).length > 0
  ) {
    await metricService.createContract(
      contract,
      {
        tvl: contractAdapterData.metrics.tvl ?? '0',
        aprDay: contractAdapterData.metrics.aprDay ?? '0',
        aprWeek: contractAdapterData.metrics.aprWeek ?? '0',
        aprMonth: contractAdapterData.metrics.aprMonth ?? '0',
        aprYear: contractAdapterData.metrics.aprYear ?? '0',
        aprBoosted: await apyBoost(
          contract.blockchain,
          contract.network,
          10000,
          Number(contractAdapterData.metrics.aprYear ?? 0),
        ),
      },
      date,
    );

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

    const tvl = new BN(contractAdapterData.metrics.tvl ?? '0');
    let choosenTag: TagTvlType['name'] | undefined;

    await container.model.contractService().unlinkAllTagsByType(contract, TagType.Tvl);

    if (tvl.gte(100_000_000)) {
      choosenTag = TagPreservedName.TvlHundredMillion;
    } else if (tvl.gte(10_000_000)) {
      choosenTag = TagPreservedName.TvlTenMillion;
    } else if (tvl.gte(1_000_000)) {
      choosenTag = TagPreservedName.TvlOneMillion;
    } else if (tvl.gte(100_000)) {
      choosenTag = TagPreservedName.TvlHundredThousand;
    }

    if (choosenTag) {
      await container.model
        .tagService()
        .createPreserved({
          type: TagType.Tvl,
          name: choosenTag,
        })
        .then((tag) => container.model.contractService().linkTag(contract, tag));
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
  const params = process.task.params as WalletMetricsParams;
  const { contract: contractId, wallet: walletId } = params;
  const blockNumber = params.blockNumber === 'latest' ? 'latest' : Number(params.blockNumber);
  const contract = await container.model
    .contractTable()
    .innerJoin(
      contractBlockchainTableName,
      `${contractBlockchainTableName}.id`,
      `${contractTableName}.id`,
    )
    .where(`${contractTableName}.id`, contractId)
    .first();
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
    const block = await provider.getBlock(blockNumber);
    if (block === null) throw new Error('Invalid block number');
    date = dayjs.unix(block.timestamp).toDate();
  }

  const contractAdapterData = await contractAdapterFactory(provider, contract.address, {
    blockNumber,
  }).catch(async (e) => {
    if (Adapters.isPriceNotResolvedError(e)) {
      const token = await getOrCreateToken(contract, e.address);
      await container.model.tokenService().update({ ...token, priceFeedNeeded: true });
    }
    throw e;
  });
  if (!contractAdapterData.wallet) return process.done();

  const walletAdapterData = await contractAdapterData
    .wallet(blockchainWallet.address)
    .catch(async (e) => {
      if (Adapters.isPriceNotResolvedError(e)) {
        const token = await getOrCreateToken(contract, e.address);
        await container.model.tokenService().update({ ...token, priceFeedNeeded: true });
      }
      throw e;
    });
  if (
    typeof walletAdapterData.metrics === 'object' &&
    Object.keys(walletAdapterData.metrics).length > 0
  ) {
    const currentMetric = await container.model
      .metricWalletRegistryTable()
      .where('contract', contract.id)
      .where('wallet', blockchainWallet.id)
      .where('period', RegistryPeriod.Latest)
      .first();
    let delta = {};
    if (walletAdapterData.metrics.earned !== undefined) {
      delta = {
        deltaEarned: new BN(walletAdapterData.metrics.earned)
          .minus(currentMetric?.data.earned ?? 0)
          .toString(10),
        deltaEarnedUSD: new BN(walletAdapterData.metrics.earnedUSD)
          .minus(currentMetric?.data.earnedUSD ?? 0)
          .toString(10),
      };
    }

    const metric = await metricService.createWallet(
      contract,
      blockchainWallet,
      {
        ...walletAdapterData.metrics,
        ...delta,
      },
      date,
    );
    if (protocol.adapter === 'uniswap3') {
      await container.model.queueService().push('eventsMetricUni3WalletCreated', {
        id: metric.id,
        positions: (walletAdapterData as any).positions,
      });
    }
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

  container.model.walletService().statisticsUpdated(blockchainWallet);
  return process.done();
}
