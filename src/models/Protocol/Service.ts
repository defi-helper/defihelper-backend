import { Blockchain } from '@models/types';
import { Factory } from '@services/Container';
import { v4 as uuid } from 'uuid';
import { Protocol, ProtocolTable, Contract, ContractTable } from './Entity';

export class ProtocolService {
  constructor(readonly table: Factory<ProtocolTable> = table) {}

  async create(
    adapter: string,
    name: string,
    description: string = '',
    icon: string | null = null,
    link: string | null = null,
    hidden: boolean = false,
  ) {
    const created = {
      id: uuid(),
      adapter,
      name,
      description,
      icon,
      link,
      hidden,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.table().insert(created);

    return created;
  }

  async update(protocol: Protocol) {
    const updated = {
      ...protocol,
      updatedAt: new Date(),
    };
    await this.table().where({ id: protocol.id }).update(updated);

    return updated;
  }

  async delete(protocol: Protocol) {
    await this.table().where({ id: protocol.id }).delete();
  }
}

export class ContractService {
  constructor(readonly table: Factory<ContractTable> = table) {}

  async create(
    protocol: Protocol,
    blockchain: Blockchain,
    network: string,
    address: string,
    name: string,
    description: string = '',
    link: string | null = null,
    hidden: boolean = false,
  ) {
    const created = {
      id: uuid(),
      protocol: protocol.id,
      blockchain,
      network,
      address,
      name,
      description,
      link,
      hidden,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.table().insert(created);

    return created;
  }

  async update(contract: Contract) {
    const updated = {
      ...contract,
      updatedAt: new Date(),
    };
    await this.table().where({ id: contract.id }).update(updated);

    return updated;
  }

  async delete(contract: Contract) {
    await this.table().where({ id: contract.id }).delete();
  }
}
