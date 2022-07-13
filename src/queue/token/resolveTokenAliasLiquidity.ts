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

  let tokenAlias = await container.model.tokenAliasTable().where(`id`, params.aliasId).first();
  if (!tokenAlias) {
    throw new Error('token alias not found');
  }

  const token = await container.debank().getToken(params.network, params.address);
  if (!token) {
    return process.done();
  }

  if ([TokenAliasLiquidity.Trash, TokenAliasLiquidity.Unknown].includes(tokenAlias.liquidity)) {
    const isLiquid =
      token?.is_verified === true || token?.is_core === true || token?.is_wallet === true;
    tokenAlias = {
      ...tokenAlias,
      liquidity: isLiquid ? TokenAliasLiquidity.Unstable : TokenAliasLiquidity.Trash,
    };
  }

  if (!tokenAlias.logoUrl) {
    tokenAlias.logoUrl = token?.logo_url ?? null;
  }

  await container.model.tokenAliasService().update(tokenAlias);

  return process.done();
};
