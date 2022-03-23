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
  ): Promise<Wallet & WalletBlockchain> {
    const wallet: Wallet = {
      id: uuid(),
      user: user.id,
      name,
      suspendReason: null,
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
    };

    await this.database.transaction(async (trx) => {
      await this.walletTable().insert(wallet).transacting(trx);
      await this.walletBlockchainTable().insert(blockchainWallet).transacting(trx);
    });
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
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const exchangeWallet: WalletExchange = {
      id: wallet.id,
      exchange,
      payload: this.crypto.encryptJson(payload),
    };

    await this.database.transaction(async (trx) => {
      await this.walletTable().insert(wallet).transacting(trx);
      await this.walletExchangeTable().insert(exchangeWallet).transacting(trx);
    });
    this.onExchangeWalletCreated.emit({ wallet, exchangeWallet });

    return { ...wallet, ...exchangeWallet };
  }

  deleteBlockchainWallet({ id }: Wallet) {
    return this.database.transaction(async (trx) => {
      await this.walletTable().where('id', id).delete().transacting(trx);
      await this.walletBlockchainTable().where('id', id).delete().transacting(trx);
    });
  }

  deleteExchangeWallet({ id }: Wallet) {
    return this.database.transaction(async (trx) => {
      await this.walletTable().where('id', id).delete().transacting(trx);
      await this.walletExchangeTable().where('id', id).delete().transacting(trx);
    });
  }

  async updateBlockchainWallet(
    wallet: Wallet,
    blockchainWallet: WalletBlockchain,
  ): Promise<Wallet & WalletBlockchain> {
    if (wallet.id !== blockchainWallet.id) throw new Error('Invalid wallet ID');

    const walletUpdated: Wallet = {
      ...wallet,
      updatedAt: new Date(),
    };
    const walletBlockchainUpdated: WalletBlockchain = {
      ...blockchainWallet,
      address:
        blockchainWallet.blockchain === 'ethereum'
          ? blockchainWallet.address.toLowerCase()
          : blockchainWallet.address,
    };
    await this.database.transaction(async (trx) => {
      await this.walletTable().where('id', wallet.id).update(wallet).transacting(trx);
      await this.walletExchangeTable()
        .where('id', wallet.id)
        .update(walletBlockchainUpdated)
        .transacting(trx);
    });

    return { ...walletUpdated, ...walletBlockchainUpdated };
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

  async suspense(
    walletId: string,
    reason: WalletSuspenseReason | null,
  ): Promise<WalletSuspenseReason | null> {
    await this.walletTable().where({ id: walletId }).update({
      suspendReason: reason,
    });

    return reason;
  }
}
