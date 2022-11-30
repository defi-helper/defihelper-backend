import container from '@container';
import { Process } from '@models/Queue/Entity';
import {
  Wallet,
  walletBlockchainTableName,
  WalletBlockchainType,
  walletTableName,
} from '@models/Wallet/Entity';
import {
  Contract,
  contractDebankTableName,
  contractTableName,
  protocolTableName,
  TokenContractLinkType,
} from '@models/Protocol/Entity';
import { TokenAliasLiquidity, TokenCreatedBy, Token, tokenTableName } from '@models/Token/Entity';
import BN from 'bignumber.js';
import { ProtocolListItem, TemporaryOutOfService } from '@services/Debank';
import {
  MetricWalletRegistry,
  MetricWalletToken,
  metricWalletTokenRegistryTableName,
  RegistryPeriod,
} from '@models/Metric/Entity';
import dayjs from 'dayjs';

interface Params {
  id: string;
}

const makePoolHashAddress = (tokens: { id: string; chain: string; protocolId: string }[]) => {
  return container.cryptography().md5(
    tokens
      .map((supply) => supply.id + supply.chain + supply.protocolId)
      .sort((a, b) => a.localeCompare(b))
      .join(':'),
  );
};

const toucher = () => ({
  values: new Map<string, string[]>(),
  touch(key: string, value: string) {
    const values = this.values.get(key) ?? [];
    this.values.set(key, [...values, value]);
  },
  has(key: string, value: string) {
    const values = this.values.get(key) ?? [];
    return values.includes(value);
  },
});

export default async (process: Process) => {
  const { id: walletId } = process.task.params as Params;

  const walletMetrics = container.model.metricService();
  const contractService = container.model.contractService();
  const targetWallet = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where(`${walletTableName}.id`, walletId)
    .first();

  if (!targetWallet || targetWallet.blockchain !== 'ethereum') {
    throw new Error('wallet not found or unsupported blockchain');
  }
  const chainsWallets = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where({
      address: targetWallet.address,
      blockchain: 'ethereum',
      type: WalletBlockchainType.Wallet,
    })
    .orderBy('createdAt', 'desc');

  const database = container.database();
  const lastTokenMetricsAcrossWallets: {
    [walletId: string]: (Token & { balance: string; contract: string })[];
  } = await chainsWallets.reduce(async (prev, curr) => {
    return {
      ...(await prev),
      [curr.id]: await container.model
        .metricWalletTokenRegistryTable()
        .column(`${tokenTableName}.*`)
        .column(
          database.raw(
            `(${metricWalletTokenRegistryTableName}.data->>'balance')::numeric AS balance`,
          ),
        )
        .column(`${metricWalletTokenRegistryTableName}.contract`)
        .innerJoin(
          tokenTableName,
          `${metricWalletTokenRegistryTableName}.token`,
          `${tokenTableName}.id`,
        )
        .where(`${metricWalletTokenRegistryTableName}.period`, RegistryPeriod.Latest)
        .where(`${metricWalletTokenRegistryTableName}.wallet`, curr.id)
        .whereNotNull(`${metricWalletTokenRegistryTableName}.contract`),
    };
  }, Promise.resolve({}));

  const lastMetricsAcrossWallets = await container.model
    .metricWalletRegistryTable()
    .where('period', RegistryPeriod.Latest)
    .whereIn(
      'wallet',
      chainsWallets.map(({ id }) => id),
    )
    .whereNotNull('contract')
    .then((rows) =>
      rows.reduce<Record<string, MetricWalletRegistry>>(
        (res, metric) => ({ ...res, [metric.wallet]: metric }),
        {},
      ),
    );

  const protocolAdaptersMap = await container.model
    .protocolTable()
    .column('debankId', 'adapter')
    .then((protocols) => new Map(protocols.map(({ adapter, debankId }) => [debankId, adapter])));

  let debankUserProtocolsListRaw: ProtocolListItem[];
  try {
    debankUserProtocolsListRaw = await container
      .debank()
      .getProtocolListWallet(targetWallet.address);
  } catch (e) {
    if (e instanceof TemporaryOutOfService) {
      return process
        .info('postponed due to temporarily service unavailability')
        .later(dayjs().add(5, 'minute').toDate());
    }

    throw e;
  }

  const debankUserProtocolsList = debankUserProtocolsListRaw.reduce<ProtocolListItem[]>(
    (result, protocol) => {
      if (container.debank().chainResolver(protocol.chain) === undefined) {
        return result;
      }
      const protocolNormalize = {
        ...protocol,
        id: protocol.id.replace(`${protocol.chain}_`, ''),
      };
      // Skip not debank protocols
      const adapter = protocolAdaptersMap.get(protocolNormalize.id);
      if (adapter !== undefined && adapter !== 'debankByApiReadonly') {
        return result;
      }

      return [...result, protocolNormalize];
    },
    [],
  );

  const existingProtocols = await container.model.protocolTable().whereIn(
    'debankId',
    debankUserProtocolsList.map(({ id }) => id),
  );

  await Promise.all(
    existingProtocols.map((protocol) =>
      Promise.all([
        container.model.protocolService().update({
          ...protocol,
          metric: {
            tvl:
              debankUserProtocolsList.find((p) => p.id === protocol.debankId)?.tvl.toString(10) ??
              '0',
          },
        }),
        container.model.metricService().createProtocol(
          protocol,
          {
            tvl:
              debankUserProtocolsList.find((p) => p.id === protocol.debankId)?.tvl.toString(10) ??
              '0',
          },
          new Date(),
        ),
      ]),
    ),
  );

  const protocols = [
    ...existingProtocols,
    ...(await Promise.all(
      debankUserProtocolsList.map(async (protocol) => {
        const exising = existingProtocols.some((existing) => existing.debankId === protocol.id);
        if (exising) {
          return null;
        }

        return container.model
          .protocolService()
          .create(
            'debankByApiReadonly',
            protocol.name,
            '',
            protocol.logo_url,
            protocol.logo_url,
            protocol.site_url,
            undefined,
            true,
            { tvl: protocol.tvl.toString(10) },
            protocol.id,
            null,
          );
      }),
    )),
  ].filter((v) => v);

  const stakingContracts = debankUserProtocolsList.flatMap((protocol) =>
    protocol.portfolio_item_list
      .filter(
        (a) => a.detail_types.toString() === ['common'].toString() && a.detail.supply_token_list,
      )
      .map((contract) => {
        if (!contract.detail.supply_token_list) {
          throw new Error('Supply token list not found');
        }

        const tokens = [
          ...contract.detail.supply_token_list.map((v) => ({
            ...v,
            type: 'liquidity',
            protocolId: protocol.id,
          })),

          ...(contract.detail.reward_token_list || []).map((v) => ({
            ...v,
            type: 'reward',
            protocolId: protocol.id,
          })),
        ];

        return {
          protocol: protocol.id,
          tokens,
          contractName:
            contract.detail.supply_token_list.map(({ symbol }) => symbol).join('/') || '',
          hashAddress: makePoolHashAddress(
            contract.detail.supply_token_list.map(({ id, chain }) => ({
              id,
              chain,
              protocolId: protocol.id,
            })),
          ),
        };
      }),
  );

  const existingContracts = await container.model
    .contractTable()
    .innerJoin(contractDebankTableName, `${contractDebankTableName}.id`, `${contractTableName}.id`)
    .innerJoin(protocolTableName, `${protocolTableName}.id`, `${contractTableName}.protocol`)
    .column(`${contractDebankTableName}.*`)
    .column(`${protocolTableName}.debankId`)
    .whereIn(
      `${contractDebankTableName}.address`,
      stakingContracts.map((v) => v.hashAddress),
    );

  const contracts = await Promise.all(
    stakingContracts
      .filter((contract) => {
        const existingContract = existingContracts.find(
          (v) => v.address === contract.hashAddress && contract.protocol === v.debankId,
        );

        return existingContract?.adapter !== 'debankByApiReadonly';
      })
      .map(async ({ protocol, hashAddress, contractName }) => {
        const existingProtocol = protocols.find((existings) => existings?.debankId === protocol);
        const existingContract = existingContracts.find(
          (v) => v.address === hashAddress && protocol === v.debankId,
        );

        if (existingContract) return existingContract;
        if (!existingProtocol) {
          throw new Error('protocol must be found here');
        }

        const contract = await container.model
          .contractService()
          .createDebank(existingProtocol, hashAddress, contractName, '', '', false);
        await container.model.metricService().createContract(
          contract,
          {
            tvl:
              debankUserProtocolsList.find((p) => p.id === contract.protocol)?.tvl.toString(10) ??
              '0',
          },
          new Date(),
        );

        return contract;
      }),
  );

  const existingTokens = await container.model
    .tokenTable()
    .whereIn('address', [
      ...stakingContracts.flatMap(({ tokens }) => tokens.map((token) => token.id.toLowerCase())),
    ]);

  const debankTokensList = stakingContracts.flatMap((contract) =>
    contract.tokens.map((token) => ({
      ...token,
      protocolId: contract.protocol,
      protocolHashAddress: contract.hashAddress,
    })),
  );

  const touchedWalletContracts = toucher();
  const touchedTokenMetrics: { [walletId: string]: MetricWalletToken[] } = {};
  const appliedTokens: {
    [walletUuid: string]: {
      [contractUuid: string]: {
        [tokenUuid: string]: {
          contractEntity: Contract;
          walletEntity: Wallet;
          tokenEntity: Token & { price: BN; amount: BN };
          earnedBalance: BN;
          stakedBalance: BN;
          earnedUSD: BN;
          stakedUSD: BN;
        };
      };
    };
  } = {};

  const applyTokenBalance = (
    wallet: Wallet,
    contract: Contract,
    token: Token & { price: BN; amount: BN },
    type: 'staked' | 'earned',
  ) => {
    if (!appliedTokens[wallet.id]) {
      appliedTokens[wallet.id] = {};
    }

    if (!appliedTokens[wallet.id][contract.id]) {
      appliedTokens[wallet.id][contract.id] = {};
    }

    if (!appliedTokens[wallet.id][contract.id][token.id]) {
      appliedTokens[wallet.id][contract.id][token.id] = {
        contractEntity: contract,
        walletEntity: wallet,
        tokenEntity: token,
        earnedBalance: new BN(0),
        stakedBalance: new BN(0),
        earnedUSD: new BN(0),
        stakedUSD: new BN(0),
      };
    }

    appliedTokens[wallet.id][contract.id][token.id] = {
      ...appliedTokens[wallet.id][contract.id][token.id],
      tokenEntity: {
        ...appliedTokens[wallet.id][contract.id][token.id].tokenEntity,
        amount: appliedTokens[wallet.id][contract.id][token.id].tokenEntity.amount.plus(
          token.amount,
        ),
      },
      earnedBalance: appliedTokens[wallet.id][contract.id][token.id].earnedBalance.plus(
        type === 'earned' ? token.amount : 0,
      ),
      stakedBalance: appliedTokens[wallet.id][contract.id][token.id].stakedBalance.plus(
        type === 'staked' ? token.amount : 0,
      ),
      earnedUSD: appliedTokens[wallet.id][contract.id][token.id].earnedUSD.plus(
        type === 'earned' ? token.amount.multipliedBy(token.price) : 0,
      ),
      stakedUSD: appliedTokens[wallet.id][contract.id][token.id].stakedUSD.plus(
        type === 'staked' ? token.amount.multipliedBy(token.price) : 0,
      ),
    };
  };

  await debankTokensList.reduce<Promise<unknown>>(async (prev, token) => {
    await prev;

    let tokenRecord = existingTokens.find(
      (exstng) =>
        exstng.address.toLowerCase() === token.id.toLowerCase() &&
        exstng.network === container.debank().chainResolver(token.chain)?.numbered,
    );
    if (!tokenRecord) {
      let tokenRecordAlias = await container.model
        .tokenAliasTable()
        .where('name', 'ilike', token.name)
        .first();

      if (!tokenRecordAlias) {
        tokenRecordAlias = await container.model
          .tokenAliasService()
          .create(
            token.name ?? '',
            token.symbol ?? '',
            TokenAliasLiquidity.Unstable,
            token.logo_url || null,
          );
      }

      try {
        tokenRecord = await container.model
          .tokenService()
          .create(
            tokenRecordAlias,
            'ethereum',
            container.debank().chainResolver(token.chain)?.numbered ?? '',
            token.id.toLowerCase(),
            token.name ?? '',
            token.symbol ?? '',
            token.decimals,
            TokenCreatedBy.Scanner,
          );
      } catch (e: any) {
        // uniq violation
        if (e.code !== '23505') {
          throw e;
        }

        tokenRecord = await container.model
          .tokenTable()
          .where('blockchain', 'ethereum')
          .andWhere('network', container.debank().chainResolver(token.chain)?.numbered)
          .andWhere('address', token.id.toLowerCase())
          .first();

        if (!tokenRecord) {
          throw new Error('[2] can`t find token on fly, seems like a bug');
        }
      }
    } else {
      const tokenRecordAlias = await container.model
        .tokenAliasTable()
        .where('name', 'ilike', token.name)
        .first();

      if (tokenRecordAlias && token.logo_url && tokenRecordAlias.logoUrl !== token.logo_url) {
        await container.model.tokenAliasService().update({
          ...tokenRecordAlias,
          logoUrl: token.logo_url,
        });
      }
    }

    const walletByChain = chainsWallets.find(
      (wallet) => wallet.network === container.debank().chainResolver(token.chain)?.numbered,
    );
    if (!walletByChain) {
      return null;
    }

    const contract = contracts.find((c) => c.address === token.protocolHashAddress);
    if (!contract) {
      throw new Error('Contract must be found');
    }

    await Promise.all([
      contractService.tokenLink(contract, [
        {
          token: tokenRecord,
          type:
            token.type === 'reward' ? TokenContractLinkType.Reward : TokenContractLinkType.Stake,
        },
      ]),
      contractService.walletLink(contract, walletByChain),
    ]);

    return applyTokenBalance(
      walletByChain,
      contract,
      {
        ...tokenRecord,
        price: new BN(token.price),
        amount: new BN(token.amount),
      },
      token.type === 'reward' ? 'earned' : 'staked',
    );
  }, Promise.resolve(null));

  await Object.keys(appliedTokens).reduce<Promise<unknown>>(async (prev, walletIndex) => {
    await prev;

    const wallet = appliedTokens[walletIndex];
    await Object.keys(wallet).reduce<Promise<unknown>>(async (prev2, contractIndex) => {
      await prev2;

      const contract = appliedTokens[walletIndex][contractIndex];
      const walletSummary = Object.keys(contract).reduce<{
        contractEntity?: Contract;
        walletEntity?: Wallet;
        earnedBalance: BN;
        stakedBalance: BN;
        earnedUSD: BN;
        stakedUSD: BN;
      }>(
        (sum, tokenIndex) => {
          const {
            earnedBalance,
            earnedUSD,
            stakedBalance,
            stakedUSD,
            contractEntity,
            walletEntity,
          } = appliedTokens[walletIndex][contractIndex][tokenIndex];

          return {
            contractEntity,
            walletEntity,
            earnedBalance: sum.earnedBalance.plus(earnedBalance),
            earnedUSD: sum.earnedUSD.plus(earnedUSD),
            stakedBalance: sum.stakedBalance.plus(stakedBalance),
            stakedUSD: sum.stakedUSD.plus(stakedUSD),
          };
        },
        {
          earnedBalance: new BN(0),
          stakedBalance: new BN(0),
          earnedUSD: new BN(0),
          stakedUSD: new BN(0),
        },
      );
      if (!walletSummary.contractEntity || !walletSummary.walletEntity) {
        throw new Error('Wallet summary does not contain any contract or wallet entity.');
      }

      await walletMetrics.createWallet(
        walletSummary.contractEntity,
        walletSummary.walletEntity,
        {
          earned: walletSummary.earnedBalance.toString(10),
          staking: walletSummary.stakedBalance.toString(10),
          earnedUSD: walletSummary.earnedUSD.toString(10),
          stakingUSD: walletSummary.stakedUSD.toString(10),
        },
        new Date(),
      );
      touchedWalletContracts.touch(walletSummary.walletEntity.id, walletSummary.contractEntity.id);

      await Object.keys(contract).reduce<Promise<unknown>>(async (prev3, tokenIndex) => {
        await prev3;

        const contractSummary = appliedTokens[walletIndex][contractIndex][tokenIndex];
        const mwt = await walletMetrics.createWalletToken(
          contractSummary.contractEntity,
          contractSummary.walletEntity,
          contractSummary.tokenEntity,
          {
            usd: contractSummary.stakedUSD.plus(contractSummary.earnedUSD).toString(10),
            balance: contractSummary.stakedBalance.plus(contractSummary.earnedBalance).toString(10),
          },
          new Date(),
        );

        if (!touchedTokenMetrics[contractSummary.walletEntity.id]) {
          touchedTokenMetrics[contractSummary.walletEntity.id] = [];
        }
        touchedTokenMetrics[contractSummary.walletEntity.id].push(mwt);
      }, Promise.resolve(null));
    }, Promise.resolve(null));
  }, Promise.resolve(null));

  await Object.entries(lastTokenMetricsAcrossWallets).reduce<Promise<unknown>>(
    async (prev, [lastMetricWalletId, metrics]) => {
      await prev;

      await metrics.reduce<Promise<unknown>>(async (prev2, metricEntry) => {
        await prev2;

        const touchedMetricsList = touchedTokenMetrics[lastMetricWalletId] ?? [];
        if (
          touchedMetricsList.some((exstng) => exstng.token === metricEntry.id) ||
          metricEntry.balance === '0'
        ) {
          return null;
        }

        const foundTargetWallet = chainsWallets.find((w) => w.id === lastMetricWalletId);
        if (!foundTargetWallet) {
          throw new Error('Wallet not found');
        }

        const foundContract = await container.model
          .contractTable()
          .where('id', metricEntry.contract)
          .first();
        if (!foundContract) {
          throw new Error('Contract not found');
        }

        return walletMetrics.createWalletToken(
          foundContract,
          foundTargetWallet,
          metricEntry,
          {
            usd: '0',
            balance: '0',
          },
          new Date(),
        );
      }, Promise.resolve(null));
    },
    Promise.resolve(null),
  );

  await Object.entries(lastMetricsAcrossWallets).reduce<Promise<unknown>>(
    async (prev, [lastMetricWalletId, metricEntry]) => {
      await prev;

      if (
        touchedWalletContracts.has(lastMetricWalletId, metricEntry.contract) ||
        (metricEntry.data.staking === '0' && metricEntry.data.earned === '0')
      ) {
        return null;
      }

      const foundTargetWallet = chainsWallets.find((w) => w.id === lastMetricWalletId);
      if (!foundTargetWallet) {
        throw new Error('Wallet not found');
      }

      const foundContract = await container.model
        .contractTable()
        .where('id', metricEntry.contract)
        .first();
      if (!foundContract) {
        throw new Error('Contract not found');
      }

      return walletMetrics.createWallet(
        foundContract,
        foundTargetWallet,
        {
          earned: '0',
          staking: '0',
          earnedUSD: '0',
          stakingUSD: '0',
        },
        new Date(),
      );
    },
    Promise.resolve(null),
  );

  await container.model.walletService().statisticsUpdated(targetWallet);

  return process.done();
};
