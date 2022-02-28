import { Process } from '@models/Queue/Entity';
import container from '@container';
import { TokenAliasLiquidity } from '@models/Token/Entity';
import axios from 'axios';

export interface Params {
  aliasId: string;
  network: string;
  address: string;
}

export interface ApiTokenResponse {
  is_verified?: boolean;
  is_core?: boolean;
  is_wallet?: boolean;
  logo_url?: string;
}

export default async (process: Process) => {
  const params = process.task.params as Params;

  const tokenAlias = await container.model.tokenAliasTable().where(`id`, params.aliasId).first();
  if (!tokenAlias) {
    throw new Error('token alias not found');
  }

  let chain: 'movr' | 'eth' | 'bsc' | 'matic' | 'avax';
  switch (params.network) {
    case '1':
      chain = 'eth';
      break;
    case '56':
      chain = 'bsc';
      break;
    case '137':
      chain = 'matic';
      break;
    case '43114':
      chain = 'avax';
      break;
    case '1285':
      chain = 'movr';
      break;
    default:
      throw new Error(`unsupported network: ${params.network}`);
  }

  const token: ApiTokenResponse = (
    await axios.get(`https://openapi.debank.com/v1/token?chain_id=${chain}&id=${params.address}`)
  ).data;

  const isLiquid =
    token?.is_verified === true || token?.is_core === true || token?.is_wallet === true;
  await container.model.tokenAliasService().update({
    ...tokenAlias,
    liquidity: isLiquid ? TokenAliasLiquidity.Unstable : TokenAliasLiquidity.Trash,
    logoUrl: token.logo_url || null,
  });

  return process.done();
};
