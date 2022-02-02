import container from '@container';
import { Process } from '@models/Queue/Entity';
import { TokenAliasLiquidity, TokenCreatedBy } from '@models/Token/Entity';
import BN from 'bignumber.js';
import axios from 'axios';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';

interface Params {
  id: string;
}

interface AssetToken {
  id: string;
  chain: 'movr';
  name: string;
  symbol: string;
  decimals: number;
  logo_url: string | null;
  price: number;
  amount: number;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const walletMetrics = container.model.metricService();
  const blockchainWallet = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where(`${walletTableName}.id`, id)
    .first();
  let chain: 'movr';

  if (!blockchainWallet || blockchainWallet.blockchain !== 'ethereum') {
    throw new Error('wallet not found or unsupported blockchain');
  }

  switch (blockchainWallet.network) {
    case '1285':
      chain = 'movr';
      break;
    default:
      throw new Error(`unsupported network: ${blockchainWallet.network}`);
  }

  const debankUserTokenList = (
    (
      await axios.get(
        `https://openapi.debank.com/v1/user/token_list?id=${blockchainWallet.address}&chain_id=${chain}&is_all=true`,
      )
    ).data as AssetToken[]
  ).map((tokenAsset) => {
    return {
      ...tokenAsset,
      id:
        tokenAsset.id === tokenAsset.chain
          ? '0x0000000000000000000000000000000000000000'
          : tokenAsset.id,
    };
  });

  const existingTokensRecords = await container.model
    .tokenTable()
    .whereIn(
      'address',
      debankUserTokenList.map((token) => token.id.toLowerCase()),
    )
    .andWhere('blockchain', blockchainWallet.blockchain)
    .andWhere('network', blockchainWallet.network);

  await Promise.all(
    debankUserTokenList.map(async (tokenAsset) => {
      let tokenRecord = existingTokensRecords.find(
        (exstng) => exstng.address.toLowerCase() === tokenAsset.id,
      );

      if (!tokenRecord) {
        let tokenRecordAlias = await container.model
          .tokenAliasTable()
          .where('name', 'ilike', tokenAsset.name)
          .first();

        if (!tokenRecordAlias) {
          tokenRecordAlias = await container.model
            .tokenAliasService()
            .create(
              tokenAsset.name,
              tokenAsset.symbol,
              TokenAliasLiquidity.Unstable,
              tokenAsset.logo_url || null,
            );
        }

        tokenRecord = await container.model
          .tokenService()
          .create(
            tokenRecordAlias,
            blockchainWallet.blockchain,
            blockchainWallet.network,
            tokenAsset.id.toLowerCase(),
            tokenAsset.name,
            tokenAsset.symbol,
            new BN(tokenAsset.decimals).toNumber(),
            TokenCreatedBy.Scanner,
          );
      }

      return walletMetrics.createToken(
        null,
        blockchainWallet,
        tokenRecord,
        {
          usd: new BN(tokenAsset.price).multipliedBy(tokenAsset.amount).toString(10),
          balance: tokenAsset.amount.toString(10),
        },
        new Date(),
      );
    }),
  );

  return process.done();
};
