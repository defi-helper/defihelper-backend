import container from '@container';
import { Process } from '@models/Queue/Entity';
import axios from 'axios';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import { contractTableName, protocolTableName } from '@models/Protocol/Entity';
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

type NamedChain = 'eth' | 'matic' | 'bsc' | 'avax' | 'movr';
const namedChainToNumbered = (namedChain: NamedChain): string => {
  const chains = {
    eth: '1',
    bsc: '56',
    matic: '137',
    movr: '1285',
    avax: '43114',
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
    });

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
      container.model.protocolService().update({
        ...protocol,
        metric: {
          tvl:
            debankUserProtocolsList.find((p) => p.id === protocol.debankId)?.tvl.toString(10) ??
            '0',
        },
      }),
    ),
  );

  const protocols = [
    ...existingProtocols,
    ...(await Promise.all(
      debankUserProtocolsList.map(async (protocol) => {
        const exising = existingProtocols.some((existing) => existing.debankId === protocol.id);
        if (exising) return null;

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
      .map((contract) => ({
        protocol: protocol.id,
        tokens: contract.detail.supply_token_list || [],
        contractName:
          contract.detail.supply_token_list?.map((supply) => supply.symbol).join('/') || '',
        hashAddress: container
          .cryptography()
          .md5(
            contract.detail.supply_token_list
              ?.map((supply) => supply.id + supply.chain + protocol.id)
              ?.join(':') || '',
          ),
      })),
  );

  const existingContracts = await container.model
    .contractTable()
    .innerJoin(protocolTableName, `${protocolTableName}.id`, `${contractTableName}.protocol`)
    .column(`${contractTableName}.*`)
    .column(`${protocolTableName}.debankId`)
    .column(`${protocolTableName}.adapter`)
    .whereIn(
      'debankAddress',
      stakingContracts.map((v) => v.hashAddress),
    );

  const contracts = await Promise.all(
    stakingContracts
      .filter((contract) => {
        const existingContract = existingContracts.find(
          (v) => v.debankAddress === contract.hashAddress && contract.protocol === v.debankId,
        );

        return existingContract?.adapter !== 'debankByApiReadonly';
      })
      .map(async (contract) => {
        const existingProtocol = protocols.find(
          (existings) => existings?.debankId === contract.protocol,
        );
        const existingContract = existingContracts.find(
          (v) => v.debankAddress === contract.hashAddress && contract.protocol === v.debankId,
        );

        if (existingContract) return existingContract;
        if (!existingProtocol) {
          throw new Error('protocol must be found here');
        }

        return container.model
          .contractService()
          .create(
            existingProtocol,
            'ethereum',
            '1',
            '0x0000000000000000000000000000000000000000',
            '0',
            'debankApiReadonly',
            'staking',
            { adapters: [] },
            contract.contractName,
            '',
            '',
            true,
            undefined,
            contract.hashAddress,
          );
      }),
  );

  const existingTokens = await container.model.tokenTable().whereIn(
    'address',
    stakingContracts.flatMap(({ tokens }) => tokens.map((token) => token.id.toLowerCase())),
  );

  const debankTokensList = stakingContracts.flatMap((contract) =>
    contract.tokens.map((token) => ({
      ...token,
      protocolId: contract.protocol,
      protocolHashAddress: contract.hashAddress,
    })),
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
      }

      const walletByChain = chainsWallets.find(
        (wallet) => wallet.network === namedChainToNumbered(token.chain as NamedChain),
      );

      if (!walletByChain) {
        return null;
      }

      return walletMetrics.createToken(
        contracts.find((c) => c.debankAddress === token.protocolHashAddress) || null,
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

  return process.done();
};
