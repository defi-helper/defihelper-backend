import container from '@container';
import { Process } from '@models/Queue/Entity';
import axios from 'axios';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';

interface Params {
  id: string;
}

interface AssetToken {
  id: string;
  chain: string;
  symbol: string;
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
    };
  });

  const existingProtocols = await container.model.protocolTable().whereIn(
    'debankId',
    debankUserProtocolsList.map((v) => v.id),
  );

  const protocols = [
    ...existingProtocols,
    ...(await Promise.all(
      debankUserProtocolsList.map(async (v) => {
        const exising = existingProtocols.some((existing) => existing.debankId === v.id);
        if (exising) return null;

        return container.model
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
    )),
  ].filter((v) => v);

  const stakingContracts = debankUserProtocolsList.map((v) => ({
    protocol: v.id,
    contracts: v.portfolio_item_list
      .filter((a) => {
        return a.detail_types.toString() === ['common'].toString() && a.detail.supply_token_list;
      })
      .map((contract) => {
        console.warn(contract.detail_types);
        return {
          contractName:
            contract.detail.supply_token_list?.map((supply) => supply.symbol).join('/') || '',
          rawAddress:
            contract.detail.supply_token_list
              ?.map((supply) => supply.id + supply.chain)
              ?.join(':') || '',
          hashAddress: container
            .cryptography()
            .md5(
              contract.detail.supply_token_list
                ?.map((supply) => supply.id + supply.chain)
                ?.join(':') || '',
            ),
        };
      }),
  }));

  const list = await Promise.all(
    stakingContracts.flatMap((v) =>
      Promise.all(
        v.contracts.map((a) => {
          const protocol = protocols.find((existings) => existings?.debankId === v.protocol);

          if (!protocol) {
            return null;
          }

          return container.model
            .contractService()
            .create(
              protocol,
              'ethereum',
              '1',
              '0x0000000000000000000000000000000000000000',
              '0',
              'debankApiReadonly',
              'staking',
              { adapters: [] },
              a.contractName,
              '',
              '',
              true,
              [],
              a.hashAddress,
            );
        }),
      ),
    ),
  );

  console.warn(JSON.stringify(list));

  return process.done();
};
