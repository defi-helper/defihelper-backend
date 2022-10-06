import { Factory } from '@services/Container';
import Knex from 'knex';
import { v4 as uuid } from 'uuid';
import { User } from '@models/User/Entity';
import { Blockchain } from '@models/types';
import { Emitter } from '@services/Event';
import { Cryptography } from '@services/Cryptography';
import container from '@container';
import {
  Wallet,
  WalletBlockchain,
  WalletBlockchainTable,
  WalletExchange,
  WalletExchangeTable,
  WalletExchangeType,
  WalletSuspenseReason,
  WalletTable,
  WalletBlockchainType,
} from './Entity';

export class WalletService {
  constructor(
    readonly database: Knex,
    readonly walletTable: Factory<WalletTable>,
    readonly walletExchangeTable: Factory<WalletExchangeTable>,
    readonly walletBlockchainTable: Factory<WalletBlockchainTable>,
    readonly crypto: Cryptography,
  ) {}

  public readonly onBlockchainWalletCreated = new Emitter<{
    wallet: Wallet;
    blockchainWallet: WalletBlockchain;
  }>(async ({ wallet, blockchainWallet }) => {
    if (blockchainWallet.type !== WalletBlockchainType.Wallet) {
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

  public readonly onExchangeWalletCreated = new Emitter<{
    wallet: Wallet;
    exchangeWallet: WalletExchange;
  }>(({ wallet }) =>
    container.model.queueService().push(
      'metricsWalletBalancesCexUniversalFiller',
      {
        id: wallet.id,
      },
      { priority: 9 },
    ),
  );

  public readonly onBlockchainWalletChangeOwner = new Emitter<{ prev: Wallet; current: Wallet }>(
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

  async createBlockchainWallet(
    user: User,
    blockchain: Blockchain,
    network: string,
    type: WalletBlockchainType,
    address: string,
    publicKey: string,
    name: string,
    confirmed = true,
  ): Promise<Wallet & WalletBlockchain> {
    const wallet: Wallet = {
      id: uuid(),
      user: user.id,
      name,
      suspendReason: null,
      deletedAt: null,
      statisticsCollectedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const blockchainWallet: WalletBlockchain = {
      id: wallet.id,
      type,
      blockchain,
      network,
      address,
      publicKey,
      confirmed,
    };

    await this.database.transaction((trx) =>
      Promise.all([
        this.walletTable().insert(wallet).transacting(trx),
        this.walletBlockchainTable().insert(blockchainWallet).transacting(trx),
      ]),
    );
    this.onBlockchainWalletCreated.emit({ wallet, blockchainWallet });

    return { ...wallet, ...blockchainWallet };
  }

  async createExchangeWallet(
    user: User,
    exchange: WalletExchangeType,
    payload: Record<string, string>,
  ): Promise<Wallet & WalletExchange> {
    const wallet: Wallet = {
      id: uuid(),
      user: user.id,
      name: '',
      suspendReason: null,
      statisticsCollectedAt: new Date(),
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const exchangeWallet: WalletExchange = {
      id: wallet.id,
      exchange,
      payload: this.crypto.encryptJson(payload),
    };

    await this.database.transaction((trx) =>
      Promise.all([
        this.walletTable().insert(wallet).transacting(trx),
        this.walletExchangeTable().insert(exchangeWallet).transacting(trx),
      ]),
    );
    this.onExchangeWalletCreated.emit({ wallet, exchangeWallet });

    return { ...wallet, ...exchangeWallet };
  }

  deleteBlockchainWallet(wallet: Wallet) {
    return this.walletTable()
      .where('id', wallet.id)
      .update({ ...wallet, deletedAt: new Date() });
  }

  deleteExchangeWallet({ id }: Wallet) {
    return this.database.transaction((trx) =>
      Promise.all([
        this.walletTable().where('id', id).delete().transacting(trx),
        this.walletExchangeTable().where('id', id).delete().transacting(trx),
      ]),
    );
  }

  async updateWallet(wallet: Wallet, trx?: Knex.Transaction): Promise<Wallet> {
    const updated: Wallet = {
      id: wallet.id,
      user: wallet.user,
      name: wallet.name,
      suspendReason: wallet.suspendReason,
      statisticsCollectedAt: wallet.statisticsCollectedAt,
      deletedAt: wallet.deletedAt,
      updatedAt: new Date(),
      createdAt: wallet.createdAt,
    };
    const query = this.walletTable().where('id', wallet.id).update(updated);
    if (trx) query.transacting(trx);
    await query;
    return updated;
  }

  async updateBlockchainWallet(
    wallet: Wallet,
    blockchainWallet: WalletBlockchain,
  ): Promise<Wallet & WalletBlockchain> {
    if (wallet.id !== blockchainWallet.id) throw new Error('Invalid wallet ID');

    const walletBlockchainUpdated: WalletBlockchain = {
      ...blockchainWallet,
      address:
        blockchainWallet.blockchain === 'ethereum'
          ? blockchainWallet.address.toLowerCase()
          : blockchainWallet.address,
    };

    return this.database.transaction(async (trx) => {
      const [walletUpdated] = await Promise.all([
        this.updateWallet(wallet, trx),
        this.walletBlockchainTable()
          .where('id', blockchainWallet.id)
          .update(walletBlockchainUpdated)
          .transacting(trx),
      ]);

      return { ...walletUpdated, ...walletBlockchainUpdated };
    });
  }

  async updateExchangeWallet(
    wallet: Wallet,
    walletExchange: WalletExchange,
  ): Promise<Wallet & WalletExchange> {
    if (wallet.id !== walletExchange.id) throw new Error('Invalid wallet ID');

    const walletUpdated: Wallet = {
      ...wallet,
      updatedAt: new Date(),
    };

    await this.database.transaction((trx) =>
      Promise.all([
        this.walletTable().where('id', wallet.id).update(walletUpdated).transacting(trx),
        this.walletExchangeTable()
          .where('id', walletExchange.id)
          .update(walletExchange)
          .transacting(trx),
      ]),
    );

    return { ...walletUpdated, ...walletExchange };
  }

  async changeOwner(wallet: Wallet & WalletBlockchain, user: User) {
    if (wallet.user === user.id) return wallet;

    const updated: Wallet = {
      ...wallet,
      user: user.id,
    };
    await this.walletTable().update({ user: user.id }).where('id', wallet.id);
    this.onBlockchainWalletChangeOwner.emit({ prev: wallet, current: updated });

    return updated;
  }

  async statisticsUpdated(wallet: Wallet) {
    const statisticsCollectedAt = new Date();
    const updated: Wallet = {
      ...wallet,
      statisticsCollectedAt,
    };
    await this.walletTable()
      .update({
        statisticsCollectedAt,
      })
      .where('id', wallet.id);

    return updated;
  }

  async suspense(
    walletId: string,
    reason: WalletSuspenseReason | null,
  ): Promise<WalletSuspenseReason | null> {
    await this.walletTable().where('id', walletId).update({
      suspendReason: reason,
    });

    return reason;
  }
}
