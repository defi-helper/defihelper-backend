import { Factory } from '@services/Container';
import { v4 as uuid } from 'uuid';
import { User } from '@models/User/Entity';
import { Blockchain } from '@models/types';
import { Emitter } from '@services/Event';
import container from '@container';
import { Wallet, Table, WalletType, WalletSuspenseReason } from './Entity';

export class WalletService {
  constructor(readonly table: Factory<Table>) {}

  public readonly onCreated = new Emitter<Wallet>(async (wallet) => {
    if (wallet.type !== WalletType.Wallet) {
      return;
    }

    await container.model.queueService().push('eventsWalletCreated', {
      id: wallet.id,
    });
  });

  async create(
    user: User,
    blockchain: Blockchain,
    network: string,
    type: WalletType,
    address: string,
    publicKey: string,
    name: string,
  ): Promise<Wallet> {
    const created = {
      id: uuid(),
      user: user.id,
      blockchain,
      network,
      type,
      address: blockchain === 'ethereum' ? address.toLowerCase() : address,
      publicKey,
      name,
      isLowBalance: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.table().insert(created);

    this.onCreated.emit(created);

    return created;
  }

  async update(wallet: Wallet): Promise<Wallet> {
    const updated = {
      ...wallet,
      address: wallet.blockchain === 'ethereum' ? wallet.address.toLowerCase() : wallet.address,
      updatedAt: new Date(),
    };
    await this.table().where({ id: wallet.id }).update(updated);

    return updated;
  }

  async suspense(
    walletId: string,
    reason: WalletSuspenseReason | null,
  ): Promise<WalletSuspenseReason | null> {
    await this.table().where({ id: walletId }).update({
      suspendReason: reason,
    });

    return reason;
  }

  async delete(wallet: Wallet) {
    await this.table().where({ id: wallet.id }).delete();
  }
}
