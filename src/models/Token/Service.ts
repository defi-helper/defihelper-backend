import { Factory } from '@services/Container';
import {
  PriceFeed,
  Token,
  TokenAlias,
  TokenAliasLiquidity,
  TokenAliasTable,
  TokenCreatedBy,
  TokenPart,
  TokenPartTable,
  TokenTable,
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
  public readonly onCreated = new Emitter<Token>(async (token) => {
    if (token.blockchain === 'ethereum') {
      if (token.name === '' || token.symbol === '' || token.decimals === 0) {
        container.model.queueService().push('tokenInfoEth', { token: token.id });
      }

      if (token.alias) {
        const tokenAlias = await container.model.tokenAliasTable().where(`id`, token.alias).first();
        if (tokenAlias?.liquidity !== TokenAliasLiquidity.Unknown) {
          return;
        }

        container.model.queueService().push('resolveTokenAliasLiquidity', {
          aliasId: token.alias,
          network: token.network,
          address: token.address,
        });
      }
    }

    if (token.blockchain === 'waves') {
      container.model.queueService().push('tokenInfoWaves', { token: token.id });
    }
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

  constructor(
    readonly tokenTable: Factory<TokenTable>,
    readonly tokenPartTable: Factory<TokenPartTable>,
  ) {}

  async create(
    alias: TokenAlias | null,
    blockchain: Blockchain,
    network: string,
    address: string,
    name: string,
    symbol: string,
    decimals: number,
    createdBy: TokenCreatedBy,
    priceFeed: PriceFeed.PriceFeed | null = null,
  ) {
    const created: Token = {
      id: uuid(),
      alias: alias === null ? null : alias.id,
      blockchain,
      network,
      address,
      name,
      symbol,
      decimals,
      tradable: false,
      priceFeed,
      priceFeedNeeded: false,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.tokenTable().insert(created);
    this.onCreated.emit(created);

    return created;
  }

  async update(token: Token) {
    const updated = {
      ...token,
      updatedAt: new Date(),
    };
    await this.tokenTable().where({ id: token.id }).update(updated);
    this.onUpdated.emit({ prev: token, cur: updated });

    return updated;
  }

  async delete(token: Token) {
    await this.tokenTable().where({ id: token.id }).delete();
  }

  async part(parent: Token, childs: Token[]) {
    const duplicates = await this.tokenPartTable()
      .where('parent', parent.id)
      .then((rows) => new Map(rows.map((duplicate) => [duplicate.child, duplicate])));

    return Promise.all(
      childs.map(async (child) => {
        const duplicate = duplicates.get(child.id);
        if (duplicate) return duplicate;

        const created: TokenPart = {
          id: uuid(),
          parent: parent.id,
          child: child.id,
          createdAt: new Date(),
        };
        await this.tokenPartTable().insert(created);

        return created;
      }),
    );
  }
}
