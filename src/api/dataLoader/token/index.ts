import container from '@container';
import { TokenAlias } from '@models/Token/Entity';
import DataLoader from 'dataloader';

export const tokenAliasLoader = () =>
  new DataLoader<string, TokenAlias | null>(async (tokensAliasId) => {
    const map = new Map(
      await container.model
        .tokenAliasTable()
        .whereIn('id', tokensAliasId)
        .then((rows) => rows.map((alias) => [alias.id, alias])),
    );

    return tokensAliasId.map((id) => map.get(id) ?? null);
  });
