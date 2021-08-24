import { Factory } from '@services/Container';
import { v4 as uuid } from 'uuid';
import { User } from '@models/User/Entity';
import { Blockchain } from '@models/types';
import { Emitter } from '@services/Event';
import container from '@container';
import { Wallet, Table } from './Entity';

export class WalletService {
  constructor(readonly table: Factory<Table>) {}

  public readonly onCreated = new Emitter<Wallet>(async (wallet) => {
    if (wallet.blockchain !== 'ethereum') {
      return;
    }

    await container.model.queueService().push('findWalletContracts', {
      walletId: wallet.id,
    });
  });

  async create(
    user: User,
    blockchain: Blockchain,
    network: string,
    address: string,
    publicKey: string,
  ): Promise<Wallet> {
    const created = {
      id: uuid(),
      user: user.id,
      blockchain,
      network,
      address: blockchain === 'ethereum' ? address.toLowerCase() : address,
      publicKey,
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

  async delete(wallet: Wallet) {
    await this.table().where({ id: wallet.id }).delete();
  }
}
