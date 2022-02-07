import container from '@container';
import { Process } from '@models/Queue/Entity';
import axios from 'axios';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import { protocolIdentifierTableName, protocolTableName } from '@models/Protocol/Entity';

interface Params {
  id: string;
}

interface AssetToken {
  id: string;
  chain: string;
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

export default async (process: Process) => {
  const { id } = process.task.params as Params;

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

  const debankUserProtocolsList = (
    (
      await axios.get(
        `https://openapi.debank.com/v1/user/complex_protocol_list?id=${blockchainWallet.address}`,
      )
    ).data as ProtocolListResponse[]
  ).map((protocol) => {
    const pureProtocolId = protocol.id.replace(`${protocol.chain}_`, '');

    return {
      ...protocol,
      id: pureProtocolId,
      portfolio_item_list: protocol.portfolio_item_list.map((v) => ({
        ...v,
        poolIdentifier: container
          .cryptography()
          .md5(v.detail.supply_token_list?.map((token) => token.id + token.chain).join(':') || ''), // tokens ids
      })),
    };
  });

  const existingProtocols = await container.model
    .protocolIdentifierTable()
    .innerJoin(protocolTableName, `${protocolTableName}.id`, `${protocolIdentifierTableName}.id`)
    .whereIn(
      'identifier',
      debankUserProtocolsList.map((v) => v.id),
    );

  await Promise.all(
    debankUserProtocolsList.map(async (v) => {
      const exising = existingProtocols.some((existing) => existing.identifier === v.id);
      if (exising) return;

      container.model
        .protocolService()
        .create(
          'debankByApiReadonly',
          v.name,
          '',
          v.logo_url,
          v.logo_url,
          v.site_url,
          undefined,
          true,
          { tvl: v.tvl.toString(10) },
          v.id,
        );
    }),
  );

  console.warn(JSON.stringify(debankUserProtocolsList));

  return process.done();
};
