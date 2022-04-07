import { Process } from '@models/Queue/Entity';
import container from '@container';
import { TokenAliasLiquidity } from '@models/Token/Entity';

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

  const token = await container.debank().getToken(params.network, params.address);
  if (!token) {
    return process.done();
  }

  const isLiquid =
    token?.is_verified === true || token?.is_core === true || token?.is_wallet === true;
  await container.model.tokenAliasService().update({
    ...tokenAlias,
    liquidity: isLiquid ? TokenAliasLiquidity.Unstable : TokenAliasLiquidity.Trash,
    logoUrl: token?.logo_url || null,
  });

  return process.done();
};
