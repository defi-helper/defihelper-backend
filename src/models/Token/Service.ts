import { Factory } from '@services/Container';
import {
  TokenAlias,
  Token,
  TokenTable,
  TokenAliasTable,
  TokenAliasLiquidity,
} from '@models/Token/Entity';
import { Blockchain } from '@models/types';
import { v4 as uuid } from 'uuid';
import { Emitter } from '@services/Event';
import container from '@container';

export class TokenAliasService {
  constructor(readonly table: Factory<TokenAliasTable>) {}

  async create(
    name: string,
    symbol: string,
    liquidity: TokenAliasLiquidity,
    logoUrl: string | null,
  ) {
    const created = {
      id: uuid(),
      name,
      symbol,
      liquidity,
      logoUrl,
      protocol: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.table().insert(created);

    return created;
  }

  async update(tokenAlias: TokenAlias) {
    const updated = {
      ...tokenAlias,
      updatedAt: new Date(),
    };
    await this.table().where({ id: tokenAlias.id }).update(updated);

    return updated;
  }

  async delete(tokenAlias: TokenAlias) {
    await this.table().where({ id: tokenAlias.id }).delete();
  }
}

export class TokenService {
  public readonly onCreated = new Emitter<Token>((token) => {
    if (
      token.blockchain === 'ethereum' &&
      (token.name === '' || token.symbol === '' || token.decimals === 0)
    ) {
      return container.model.queueService().push('tokenInfoEth', { token: token.id });
    }
    if (token.blockchain === 'waves') {
      return container.model.queueService().push('tokenInfoWaves', { token: token.id });
    }

    return null;
  });

  public readonly onUpdated = new Emitter<{ prev: Token; cur: Token }>(({ cur }) => {
    if (cur.alias !== null) return null;
    if (cur.name === '') return null;

    return container.model.queueService().push(
      'tokenAlias',
      { tokenId: cur.id },
      {
        collisionSign: `tokenAlias-${cur.id}`,
      },
    );
  });

  constructor(readonly table: Factory<TokenTable>) {}

  async create(
    alias: TokenAlias | null,
    blockchain: Blockchain,
    network: string,
    address: string,
    name: string,
    symbol: string,
    decimals: number,
  ) {
    const created = {
      id: uuid(),
      alias: alias === null ? null : alias.id,
      blockchain,
      network,
      address,
      name,
      symbol,
      decimals,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.table().insert(created);
    this.onCreated.emit(created);

    return created;
  }

  async update(token: Token) {
    const updated = {
      ...token,
      updatedAt: new Date(),
    };
    await this.table().where({ id: token.id }).update(updated);
    this.onUpdated.emit({ prev: token, cur: updated });

    return updated;
  }

  async delete(token: Token) {
    await this.table().where({ id: token.id }).delete();
  }
}
