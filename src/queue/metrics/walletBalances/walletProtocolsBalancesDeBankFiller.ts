import container from '@container';
import { Process } from '@models/Queue/Entity';
import axios from 'axios';
import { Wallet, walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import {
  Contract,
  contractDebankTableName,
  contractTableName,
  protocolTableName,
} from '@models/Protocol/Entity';
import { TokenAliasLiquidity, TokenCreatedBy } from '@models/Token/Entity';
import BN from 'bignumber.js';

interface Params {
  id: string;
}

interface AssetToken {
  id: string;
  chain: string;
  symbol: string;
  amount: number;
  protocol_id: string;
  logo_url: string | null;
  name: string;
  price: number;
  type: 'liquidity' | 'reward';
  decimals: number;
}

interface ProtocolListResponse {
  id: string;
  chain: string;
  name: string;
  site_url: string;
  logo_url: string;
  tvl: number;
  portfolio_item_list: {
    detail_types: string[];
    detail: {
      supply_token_list?: AssetToken[];
      borrow_token_list?: AssetToken[];
      reward_token_list?: AssetToken[];
      token_list?: AssetToken[];
    };
  }[];
}

type NamedChain = 'eth' | 'matic' | 'bsc' | 'avax' | 'movr' | 'ftm' | 'arb' | 'op' | 'cro';
const namedChainToNumbered = (namedChain: NamedChain): string => {
  const chains = {
    eth: '1',
    bsc: '56',
    matic: '137',
    movr: '1285',
    avax: '43114',
    ftm: '250',
    arb: '42161',
    op: '10',
    cro: '25',
  };

  if (chains[namedChain]) {
    return chains[namedChain];
  }

  throw new Error(`unknown chain: ${namedChain}`);
};

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const walletMetrics = container.model.metricService();
  const targetWallet = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where(`${walletTableName}.id`, id)
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
      user: targetWallet.user,
      blockchain: 'ethereum',
    })
    .orderBy('createdAt', 'desc');

  const debankUserProtocolsList = (
    (
      await axios.get(
        `https://openapi.debank.com/v1/user/complex_protocol_list?id=${targetWallet.address}`,
      )
    ).data as ProtocolListResponse[]
  )
    .map((protocol) => {
      const pureProtocolId = protocol.id.replace(`${protocol.chain}_`, '');

      return {
        ...protocol,
        id: pureProtocolId,
      };
    })
    .filter((v) => {
      try {
        namedChainToNumbered(v.chain as NamedChain);
        return true;
      } catch {
        return false;
      }
    });

  const existingProtocols = await container.model.protocolTable().whereIn(
    'debankId',
    debankUserProtocolsList.map((v) => v.id),
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
        const tokens = [
          ...(contract.detail.supply_token_list || []).map((v) => ({
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
            contract.detail.supply_token_list?.map(({ symbol }) => symbol).join('/') || '',
          hashAddress: container
            .cryptography()
            .md5(
              contract.detail.supply_token_list
                ?.map((supply) => supply.id + supply.chain + protocol.id)
                ?.join(':') || '',
            ),
        };
      }),
  );

  const protocolsRewardTokens = debankUserProtocolsList.flatMap(
    ({
      portfolio_item_list,
      id: protocolId,
      logo_url: protocolLogo,
      name: protocolName,
      tvl: protocolTvl,
    }) =>
      portfolio_item_list
        .filter(
          ({ detail_types, detail }) =>
            detail_types.toString() === ['reward'].toString() && detail.token_list,
        )
        .flatMap(({ detail }) =>
          (detail.token_list || []).map((v) => ({
            ...v,
            type: 'reward',
            protocolId,
            protocolLogo,
            protocolName,
            protocolTvl,
          })),
        ),
  );

  const existingRewardProtocolsContracts = await container.model
    .contractTable()
    .column(`${protocolTableName}.debankId as protocolDebankId`)
    .column(`${protocolTableName}.id as protocolId`)
    .column(`${contractDebankTableName}.*`)
    .column(`${contractTableName}.*`)
    .innerJoin(contractDebankTableName, `${contractDebankTableName}.id`, `${contractTableName}.id`)
    .innerJoin(protocolTableName, `${protocolTableName}.id`, `${contractTableName}.protocol`)
    .whereIn(
      `${protocolTableName}.debankId`,
      protocolsRewardTokens.map((v) => v.protocolId),
    )
    .andWhere(`${contractDebankTableName}.address`, 'reward');

  const existingTokensProtocols = await container.model.protocolTable().whereIn(
    'debankId',
    protocolsRewardTokens.map((v) => v.protocolId),
  );

  const protocolRewardTokenExistingContracts = await Promise.all(
    protocolsRewardTokens.map(async (token) => {
      let protocol = existingTokensProtocols.find((v) => v.debankId === token.protocolId);
      if (!protocol) {
        protocol = await container.model
          .protocolService()
          .create(
            'debankByApiReadonly',
            token.protocolName,
            '',
            token.protocolLogo,
            token.protocolLogo,
            null,
            undefined,
            true,
            { tvl: token.protocolTvl.toString(10) },
            token.protocolId,
          );
      }
      const existing = existingRewardProtocolsContracts.find(
        (v) => token.protocolId === v.protocolDebankId,
      );
      if (existing) {
        return { ...existing, debankId: protocol.debankId };
      }

      return {
        debankId: protocol.debankId,
        ...(await container.model
          .contractService()
          .createDebank(protocol, 'reward', '', {}, '', null, true)),
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
      ...protocolsRewardTokens.map((v) => v.id.toLowerCase()),
    ]);

  const debankTokensList = stakingContracts.flatMap((contract) =>
    contract.tokens.map((token) => ({
      ...token,
      protocolId: contract.protocol,
      protocolHashAddress: contract.hashAddress,
    })),
  );

  const appliedTokens: {
    [walletUuid: string]: {
      [contractUuid: string]: {
        contractEntity: Contract;
        walletEntity: Wallet;
        earnedBalance: BN;
        stakedBalance: BN;
        earnedUSD: BN;
        stakedUSD: BN;
      };
    };
  } = {};

  const applyTokenBalance = (
    wallet: Wallet,
    contract: Contract,
    payload: { earnedBalance: BN; stakedBalance: BN; earnedUSD: BN; stakedUSD: BN },
  ) => {
    if (!appliedTokens[wallet.id]) {
      appliedTokens[wallet.id] = {};
    }

    if (!appliedTokens[wallet.id][contract.id]) {
      appliedTokens[wallet.id][contract.id] = {
        contractEntity: contract,
        walletEntity: wallet,
        earnedBalance: new BN(0),
        stakedBalance: new BN(0),
        earnedUSD: new BN(0),
        stakedUSD: new BN(0),
      };
    }

    appliedTokens[wallet.id][contract.id] = {
      ...appliedTokens[wallet.id][contract.id],
      earnedBalance: appliedTokens[wallet.id][contract.id].earnedBalance.plus(
        payload.earnedBalance,
      ),
      stakedBalance: appliedTokens[wallet.id][contract.id].stakedBalance.plus(
        payload.stakedBalance,
      ),
      earnedUSD: appliedTokens[wallet.id][contract.id].earnedUSD.plus(payload.earnedUSD),
      stakedUSD: appliedTokens[wallet.id][contract.id].stakedUSD.plus(payload.stakedUSD),
    };
  };

  await Promise.all(
    protocolsRewardTokens.map(async (token) => {
      let tokenRecord = existingTokens.find(
        (exstng) =>
          exstng.address.toLowerCase() === token.id.toLowerCase() &&
          exstng.network === namedChainToNumbered(token.chain as NamedChain),
      );

      if (!tokenRecord) {
        let tokenRecordAlias = await container.model
          .tokenAliasTable()
          .where('name', 'ilike', token.name)
          .first();

        if (!tokenRecordAlias) {
          tokenRecordAlias = await container.model
            .tokenAliasService()
            .create(token.name, token.symbol, TokenAliasLiquidity.Unstable, token.logo_url || null);
        }

        try {
          tokenRecord = await container.model
            .tokenService()
            .create(
              tokenRecordAlias,
              'ethereum',
              namedChainToNumbered(token.chain as NamedChain),
              token.id.toLowerCase(),
              token.name,
              token.symbol,
              token.decimals,
              TokenCreatedBy.Scanner,
            );
        } catch (e) {
          // uniq violation
          if (e.code !== '23505') {
            throw e;
          }

          tokenRecord = await container.model
            .tokenTable()
            .where('blockchain', 'ethereum')
            .andWhere('network', namedChainToNumbered(token.chain as NamedChain))
            .andWhere('address', token.id.toLowerCase())
            .first();

          if (!tokenRecord) {
            throw new Error('[1] can`t find token on fly, seems like a bug');
          }
        }
      }

      const walletByChain = chainsWallets.find(
        (wallet) => wallet.network === namedChainToNumbered(token.chain as NamedChain),
      );

      if (!walletByChain) {
        return null;
      }

      const rewardContract = protocolRewardTokenExistingContracts.find(
        (v) => v.debankId === token.protocolId,
      );
      if (!rewardContract) {
        throw new Error('Reward contract must be found');
      }

      applyTokenBalance(walletByChain, rewardContract, {
        earnedBalance: new BN(token.amount),
        stakedBalance: new BN(0),
        earnedUSD: new BN(token.price).multipliedBy(token.amount),
        stakedUSD: new BN(0),
      });

      return walletMetrics.createWalletToken(
        rewardContract,
        walletByChain,
        tokenRecord,
        {
          usd: new BN(token.price).multipliedBy(token.amount).toString(10),
          balance: new BN(token.amount).toString(10),
        },
        new Date(),
      );
    }),
  );

  await Promise.all(
    debankTokensList.map(async (token) => {
      let tokenRecord = existingTokens.find(
        (exstng) =>
          exstng.address.toLowerCase() === token.id.toLowerCase() &&
          exstng.network === namedChainToNumbered(token.chain as NamedChain),
      );

      if (!tokenRecord) {
        let tokenRecordAlias = await container.model
          .tokenAliasTable()
          .where('name', 'ilike', token.name)
          .first();

        if (!tokenRecordAlias) {
          tokenRecordAlias = await container.model
            .tokenAliasService()
            .create(token.name, token.symbol, TokenAliasLiquidity.Unstable, token.logo_url || null);
        }

        try {
          tokenRecord = await container.model
            .tokenService()
            .create(
              tokenRecordAlias,
              'ethereum',
              namedChainToNumbered(token.chain as NamedChain),
              token.id.toLowerCase(),
              token.name,
              token.symbol,
              token.decimals,
              TokenCreatedBy.Scanner,
            );
        } catch (e) {
          // uniq violation
          if (e.code !== '23505') {
            throw e;
          }

          tokenRecord = await container.model
            .tokenTable()
            .where('blockchain', 'ethereum')
            .andWhere('network', namedChainToNumbered(token.chain as NamedChain))
            .andWhere('address', token.id.toLowerCase())
            .first();

          if (!tokenRecord) {
            throw new Error('[2] can`t find token on fly, seems like a bug');
          }
        }
      }

      const walletByChain = chainsWallets.find(
        (wallet) => wallet.network === namedChainToNumbered(token.chain as NamedChain),
      );

      if (!walletByChain) {
        // todo maybe should create wallet here
        return null;
      }

      const contract = contracts.find((c) => c.address === token.protocolHashAddress);
      if (!contract) {
        throw new Error('Contract must be found');
      }

      applyTokenBalance(walletByChain, contract, {
        earnedBalance: token.type === 'reward' ? new BN(token.amount) : new BN(0),
        stakedBalance: token.type === 'liquidity' ? new BN(token.amount) : new BN(0),
        earnedUSD:
          token.type === 'reward' ? new BN(token.price).multipliedBy(token.amount) : new BN(0),
        stakedUSD:
          token.type === 'liquidity' ? new BN(token.price).multipliedBy(token.amount) : new BN(0),
      });

      return walletMetrics.createWalletToken(
        contract,
        walletByChain,
        tokenRecord,
        {
          usd: new BN(token.price).multipliedBy(token.amount).toString(10),
          balance: new BN(token.amount).toString(10),
        },
        new Date(),
      );
    }),
  );

  await Promise.all(
    Object.keys(appliedTokens).map((walletIndex) => {
      const wallet = appliedTokens[walletIndex];

      return Promise.all(
        Object.keys(wallet).map((contractIndex) => {
          const contractSummary = appliedTokens[walletIndex][contractIndex];

          return container.model.metricService().createWallet(
            contractSummary.contractEntity,
            contractSummary.walletEntity,
            {
              earned: contractSummary.earnedBalance.toString(10),
              staking: contractSummary.stakedBalance.toString(10),
              earnedUSD: contractSummary.earnedUSD.toString(10),
              stakingUSD: contractSummary.stakedUSD.toString(10),
            },
            new Date(),
          );
        }),
      );
    }),
  );

  return process.done();
};
