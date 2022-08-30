import { Process } from '@models/Queue/Entity';
import container from '@container';
import { networksMap } from '@services/WhatToFarm';
import { Token } from '@services/Debank';
import { TokenAliasLiquidity, TokenCreatedBy } from '@models/Token/Entity';
import dayjs from 'dayjs';

export interface Params {
  page: number;
}

export default async (process: Process) => {
  const { page } = process.task.params as Params;

  if (!page) {
    throw new Error('Invalid page, it have to be 1 or greater');
  }

  const auth = await container.whattofarm().login();
  const pools = await container.whattofarm().poolsList(auth.data.access_token, page);

  if (!pools.data.list.length) {
    return process.done().info(`iterated successfully, last page was ${page}`);
  }

  const debank = container.debank();
  await pools.data.list.reduce<Promise<void>>(async (prev, curr) => {
    await prev;

    const chainNumber = networksMap[curr.pairInfo.lpToken.network.name as keyof typeof networksMap];
    if (!chainNumber) {
      return;
    }

    const debankTypedChain = debank.chainResolver(chainNumber);
    if (!debankTypedChain) {
      return;
    }

    const tokens = (
      await Promise.all(
        curr.pairInfo.tokens.map((t) =>
          debank.getToken(debankTypedChain.named, t.address).catch(() => null),
        ),
      )
    ).filter((v) => v) as Token[];

    const existingTokens = await container.model
      .tokenTable()
      .whereIn(
        'address',
        tokens.map((v) => v.id.toLowerCase()),
      )
      .andWhere('blockchain', 'ethereum')
      .andWhere('network', chainNumber);

    await Promise.all(
      tokens.map(async (token) => {
        if (existingTokens.some((v) => v.address.toLowerCase() === token.id.toLowerCase())) {
          return null;
        }

        if (!token.name || !token.symbol) {
          return null;
        }

        let tokenRecordAlias = await container.model
          .tokenAliasTable()
          .where('name', 'ilike', token.name)
          .first();

        if (!tokenRecordAlias) {
          tokenRecordAlias = await container.model
            .tokenAliasService()
            .create(token.name, token.symbol, TokenAliasLiquidity.Unstable, token.logo_url || null);
        }

        return container.model
          .tokenService()
          .create(
            tokenRecordAlias,
            'ethereum',
            chainNumber,
            token.id.toLowerCase(),
            token.name,
            token.symbol,
            Number(token.decimals),
            TokenCreatedBy.Scanner,
          );
      }),
    );
  }, Promise.resolve());

  return process
    .param({
      page: page + 1,
    })
    .later(dayjs().add(1, 'minute').toDate());
};
