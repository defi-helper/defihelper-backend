import { Factory } from '@services/Container';
import { v4 as uuid } from 'uuid';
import { User } from '@models/User/Entity';
import { Wallet, Table } from './Entity';
import { Blockchain } from '@models/types';

export class WalletService {
  constructor(readonly table: Factory<Table> = table) {}

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
      address,
      publicKey,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.table().insert(created);

    return created;
  }

  async update(wallet: Wallet): Promise<Wallet> {
    const updated = {
      ...wallet,
      updatedAt: new Date(),
    };
    await this.table().where({ id: wallet.id }).update(updated);

    return updated;
  }

  async delete(wallet: Wallet) {
    await this.table().where({ id: wallet.id }).delete();
  }
}
