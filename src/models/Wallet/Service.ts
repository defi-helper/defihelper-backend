import { Factory } from '@services/Container';
import { v4 as uuid } from 'uuid';
import { User } from '@models/User/Entity';
import { Blockchain } from '@models/types';
import { Emitter } from '@services/Event';
import container from '@container';
import {
  Wallet,
  WalletBlockchain,
  WalletBlockchainTable,
  WalletExchange,
  WalletExchangeTable,
  walletExchangeTableName,
  WalletExchangeType,
  WalletSource,
  WalletSuspenseReason,
  WalletTable,
  walletTableName,
  WalletType,
  WalletValues,
} from './Entity';

export class WalletService {
  constructor(
    readonly walletTable: Factory<WalletTable>,
    readonly walletExchangeTable: Factory<WalletExchangeTable>,
    readonly walletBlockchainTable: Factory<WalletBlockchainTable>,
  ) {}

  public readonly onCreated = new Emitter<Wallet>(async (wallet) => {
    if (wallet.type !== WalletType.Wallet) {
      return;
    }

    await Promise.all([
      container.model.queueService().push('eventsWalletCreated', {
        id: wallet.id,
      }),

      container.cache().publish(
        'defihelper:channel:onWalletCreated',
        JSON.stringify({
          id: wallet.id,
        }),
      ),
    ]);
  });

  public readonly onChangeOwner = new Emitter<{ prev: Wallet; current: Wallet }>(
    async ({ prev, current }) => {
      if (prev.user === current.user) return;

      await Promise.all([
        container.model.queueService().push('eventsWalletChangeOwner', {
          id: current.id,
          prevOwner: prev.user,
        }),
      ]);
    },
  );

  async createWallet<T extends WalletSource>(
    user: User,
    type: WalletType,
    source: T,
    name: string,
    values: WalletValues<T>,
  ): Promise<{
    parent: Wallet;
    child: WalletValues<T> & { id: string };
  }> {
    const rootWalletObject = {
      id: uuid(),
      user: user.id,
      type,
      name,
      suspendReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const rootWalletLinkedSource = {
      ...values,
      id: rootWalletObject.id,
    };

    if (!Object.values(WalletSource).includes(source)) {
      throw new Error('everything is broken');
    }

    await this.walletTable().insert(rootWalletObject);
    switch (source) {
      case WalletSource.Blockchain:
        await this.walletBlockchainTable().insert(rootWalletLinkedSource);
        break;
      case WalletSource.Exchange:
        await this.walletExchangeTable().insert(rootWalletLinkedSource);
        break;
      default:
    }

    this.onCreated.emit(rootWalletObject);

    return {
      parent: rootWalletObject,
      child: rootWalletLinkedSource,
    };
  }

  /* @deprecated use createWallet instead */
  async create(
    user: User,
    blockchain: Blockchain,
    network: string,
    type: WalletType,
    address: string,
    publicKey: string,
    name: string,
  ): Promise<Wallet & WalletBlockchain> {
    const created = await this.createWallet(user, type, WalletSource.Blockchain, name, {
      address,
      blockchain,
      network,
      publicKey,
    });

    return { ...created.parent, ...created.child };
  }

  async connectExchange(
    user: User,
    type: WalletExchangeType,
    payload: { apiKey: string; apiSecret: string },
  ): Promise<WalletExchange> {
    // todo не уверен что оно верно выбирает
    const existingExchangeConnection = await this.walletExchangeTable()
      .innerJoin(walletTableName, `${walletTableName}.id`, `${walletExchangeTableName}.id`)
      .where('user', user.id)
      .andWhere(`${walletExchangeTableName}.type`, type)
      .first();

    if (existingExchangeConnection) {
      return existingExchangeConnection;
    }

    return (
      await this.createWallet(user, WalletType.Wallet, WalletSource.Exchange, '', {
        payload: container.cryptography().encryptJson(payload),
        type,
      })
    ).child;
  }

  async disconnectExchange(entity: WalletExchange | Wallet): Promise<void> {
    await this.walletTable().where({ id: entity.id }).delete();
  }

  /* @deprecated use another method which u should make yourself. 35 DIY IDEAS */
  async updateBlockchainWallet(wallet: Wallet & WalletBlockchain): Promise<Wallet> {
    const updated = {
      ...wallet,
      address: wallet.blockchain === 'ethereum' ? wallet.address.toLowerCase() : wallet.address,
      updatedAt: new Date(),
    };
    await this.walletTable().where({ id: wallet.id }).update(updated);

    return updated;
  }

  async updateParentWalletOnly(wallet: Wallet) {
    const updated = {
      ...wallet,
      updatedAt: new Date(),
    };
    await this.walletTable().where({ id: wallet.id }).update(updated);

    return updated;
  }

  async suspense(
    walletId: string,
    reason: WalletSuspenseReason | null,
  ): Promise<WalletSuspenseReason | null> {
    await this.walletTable().where({ id: walletId }).update({
      suspendReason: reason,
    });

    return reason;
  }

  async delete(wallet: Wallet) {
    await this.walletTable().where({ id: wallet.id }).delete();
  }

  async changeOwner(wallet: Wallet, user: User) {
    if (wallet.user === user.id) return wallet;

    const updated = await this.updateParentWalletOnly({
      ...wallet,
      user: user.id,
    });
    this.onChangeOwner.emit({ prev: wallet, current: updated });

    return updated;
  }
}
