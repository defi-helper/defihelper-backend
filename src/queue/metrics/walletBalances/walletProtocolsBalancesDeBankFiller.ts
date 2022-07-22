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
import { ProtocolListItem } from '@services/Debank';
import { MetricWalletToken, metricWalletTokenTableName } from '@models/Metric/Entity';

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
        .metricWalletTokenTable()
        .distinctOn(`${metricWalletTokenTableName}.wallet`, `${metricWalletTokenTableName}.token`)
        .column(`${tokenTableName}.*`)
        .column(
          database.raw(`(${metricWalletTokenTableName}.data->>'balance')::numeric AS balance`),
        )
        .column(`${metricWalletTokenTableName}.contract`)
        .innerJoin(tokenTableName, `${metricWalletTokenTableName}.token`, `${tokenTableName}.id`)
        .whereNotNull(`${metricWalletTokenTableName}.contract`)
        .andWhere(`${metricWalletTokenTableName}.wallet`, curr.id)
        .orderBy(`${metricWalletTokenTableName}.wallet`)
        .orderBy(`${metricWalletTokenTableName}.token`)
        .orderBy(`${metricWalletTokenTableName}.date`, 'DESC'),
    };
  }, Promise.resolve({}));

  const protocolAdaptersMap = await container.model
    .protocolTable()
    .column('debankId', 'adapter')
    .then((protocols) => new Map(protocols.map(({ adapter, debankId }) => [debankId, adapter])));
  const debankUserProtocolsList = await container
    .debank()
    .getProtocolListWallet(targetWallet.address)
    .then((protocols) =>
      protocols.reduce<ProtocolListItem[]>((result, protocol) => {
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
      }, []),
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
      .map(async (contract) => {
        const existingProtocol = protocols.find(
          (existings) => existings?.debankId === contract.protocol,
        );
        const existingContract = existingContracts.find(
          (v) => v.address === contract.hashAddress && contract.protocol === v.debankId,
        );

        if (existingContract) return existingContract;
        if (!existingProtocol) {
          throw new Error('protocol must be found here');
        }

        return container.model.contractService().createDebank(
          existingProtocol,
          contract.hashAddress,
          contract.contractName,
          {
            tvl:
              debankUserProtocolsList.find((p) => p.id === contract.protocol)?.tvl.toString(10) ??
              '0',
          },
          '',
          '',
          false,
        );
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

  const touchedMetrics: { [walletId: string]: MetricWalletToken[] } = {};
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

  await Promise.all(
    debankTokensList.map(async (token) => {
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
    }),
  );

  await Promise.all(
    Object.keys(appliedTokens).map((walletIndex) => {
      const wallet = appliedTokens[walletIndex];

      return Promise.all(
        Object.keys(wallet).map((contractIndex) => {
          const contract = appliedTokens[walletIndex][contractIndex];

          const walletSummary = Object.keys(contract).reduce<{
            contractEntity?: Contract;
            walletEntity?: Wallet;
            earnedBalance: BN;
            stakedBalance: BN;
            earnedUSD: BN;
            stakedUSD: BN;
          }>(
            (prev, tokenIndex) => {
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
                earnedBalance: prev.earnedBalance.plus(earnedBalance),
                earnedUSD: prev.earnedUSD.plus(earnedUSD),
                stakedBalance: prev.stakedBalance.plus(stakedBalance),
                stakedUSD: prev.stakedUSD.plus(stakedUSD),
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

          return Promise.all([
            walletMetrics.createWallet(
              walletSummary.contractEntity,
              walletSummary.walletEntity,
              {
                earned: walletSummary.earnedBalance.toString(10),
                staking: walletSummary.stakedBalance.toString(10),
                earnedUSD: walletSummary.earnedUSD.toString(10),
                stakingUSD: walletSummary.stakedUSD.toString(10),
              },
              new Date(),
            ),
            ...Object.keys(contract).map(async (tokenIndex) => {
              const contractSummary = appliedTokens[walletIndex][contractIndex][tokenIndex];

              const mwt = await walletMetrics.createWalletToken(
                contractSummary.contractEntity,
                contractSummary.walletEntity,
                contractSummary.tokenEntity,
                {
                  usd: contractSummary.stakedUSD.plus(contractSummary.earnedUSD).toString(10),
                  balance: contractSummary.stakedBalance
                    .plus(contractSummary.earnedBalance)
                    .toString(10),
                },
                new Date(),
              );

              if (!touchedMetrics[contractSummary.walletEntity.id]) {
                touchedMetrics[contractSummary.walletEntity.id] = [];
              }
              touchedMetrics[contractSummary.walletEntity.id].push(mwt);

              return mwt;
            }),
          ] as Promise<any>[]);
        }),
      );
    }),
  );

  await Promise.all(
    Object.entries(lastTokenMetricsAcrossWallets).map(([lastMetricWalletId, metrics]) => {
      return Promise.all(
        metrics.map(async (metricEntry) => {
          if (
            touchedMetrics[lastMetricWalletId].some((exstng) => exstng.token === metricEntry.id) ||
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
        }),
      );
    }),
  );

  await container.model.walletService().statisticsUpdated(targetWallet);
  return process.done();
};
