import container from '@container';
import { Process } from '@models/Queue/Entity';
import { TokenAliasLiquidity, TokenCreatedBy, tokenTableName } from '@models/Token/Entity';
import BN from 'bignumber.js';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import { metricWalletTokenTableName } from '@models/Metric/Entity';

interface Params {
  id: string;
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

  if (!blockchainWallet || blockchainWallet.blockchain !== 'ethereum') {
    throw new Error('wallet not found or unsupported blockchain');
  }
  if (container.blockchain.ethereum.byNetwork(blockchainWallet.network).testnet) {
    throw new Error('testnet unsupported');
  }

  const debankUserTokenList = (
    await container
      .debank()
      .getTokensOnWalletNetwork(blockchainWallet.address, blockchainWallet.network)
  )
    .map((tokenAsset) => ({
      ...tokenAsset,
      id:
        tokenAsset.id === tokenAsset.chain
          ? '0x0000000000000000000000000000000000000000'
          : tokenAsset.id,
      name: (tokenAsset.name ?? '').replace(/\0/g, '').trim(),
      symbol: (tokenAsset.symbol ?? '').replace(/\0/g, '').trim(),
    }))
    .filter((v) => v.is_wallet === true);

  const existingTokensRecords = await container.model
    .tokenTable()
    .whereIn(
      'address',
      debankUserTokenList.map((token) => token.id.toLowerCase()),
    )
    .andWhere('blockchain', blockchainWallet.blockchain)
    .andWhere('network', blockchainWallet.network);

  const database = container.database();
  const lastTokenMetrics = await container.model
    .metricWalletTokenTable()
    .distinctOn(`${metricWalletTokenTableName}.wallet`, `${metricWalletTokenTableName}.token`)
    .column(`${tokenTableName}.*`)
    .column(database.raw(`(${metricWalletTokenTableName}.data->>'balance')::numeric AS balance`))
    .innerJoin(tokenTableName, `${metricWalletTokenTableName}.token`, `${tokenTableName}.id`)
    .where(`${metricWalletTokenTableName}.wallet`, blockchainWallet.id)
    .whereNull(`${metricWalletTokenTableName}.contract`)
    .orderBy(`${metricWalletTokenTableName}.wallet`)
    .orderBy(`${metricWalletTokenTableName}.token`)
    .orderBy(`${metricWalletTokenTableName}.date`, 'DESC');

  const createdMetrics = await Promise.all(
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

      return walletMetrics.createWalletToken(
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

  await Promise.all(
    lastTokenMetrics.map((v) => {
      if (createdMetrics.some((exstng) => exstng.token === v.id) || v.balance === '0') {
        return null;
      }

      return walletMetrics.createWalletToken(
        null,
        blockchainWallet,
        v,
        {
          usd: '0',
          balance: '0',
        },
        new Date(),
      );
    }),
  );

  const owner = await container.model.userTable().where('id', blockchainWallet.user).first();
  if (!owner) {
    throw new Error('Onwer must be accesible here');
  }
  container.model.userService().portfolioCollectedSuccessful(owner);
  container.model.walletService().statisticsUpdated(blockchainWallet);

  return process.done();
};
