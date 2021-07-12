import container from '@container';
import { Blockchain } from '@models/types';
import { Wallet } from '@models/Wallet/Entity';
import { Factory } from '@services/Container';
import { Emitter } from '@services/Event';
import { v4 as uuid } from 'uuid';
import {
  Protocol,
  ProtocolTable,
  Contract,
  ContractTable,
  WalletContractLinkTable,
  WalletContractLink,
} from './Entity';

export class ProtocolService {
  constructor(readonly table: Factory<ProtocolTable>) {}

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
  public readonly onCreated = new Emitter<Contract>((contract) => {
    if (
      !(contract.blockchain === 'ethereum' && contract.network === '1') ||
      contract.deployBlockNumber === null ||
      contract.deployBlockNumber === '0'
    ) {
      return null;
    }

    return container.model.queueService().push('metricsContractHistory', { contract: contract.id });
  });

  public readonly onWalletLink = new Emitter<{
    contract: Contract;
    wallet: Wallet;
    link: WalletContractLink;
  }>(({ contract, link }) => {
    if (
      !(contract.blockchain === 'ethereum' && contract.network === '1') ||
      contract.deployBlockNumber === null ||
      contract.deployBlockNumber === '0'
    ) {
      return null;
    }

    return container.model
      .queueService()
      .push('metricsWalletHistory', { contract: link.contract, wallet: link.wallet });
  });

  constructor(
    readonly contractTable: Factory<ContractTable>,
    readonly walletLinkTable: Factory<WalletContractLinkTable>,
  ) {}

  async create(
    protocol: Protocol,
    blockchain: Blockchain,
    network: string,
    address: string,
    deployBlockNumber: string | null,
    adapter: string,
    layout: string,
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
      deployBlockNumber,
      adapter,
      layout,
      name,
      description,
      link,
      hidden,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.contractTable().insert(created);
    this.onCreated.emit(created);

    return created;
  }

  async update(contract: Contract) {
    const updated = {
      ...contract,
      updatedAt: new Date(),
    };
    await this.contractTable().where({ id: contract.id }).update(updated);

    return updated;
  }

  async delete(contract: Contract) {
    await this.contractTable().where({ id: contract.id }).delete();
  }

  async walletLink(contract: Contract, wallet: Wallet) {
    const duplicate = await this.walletLinkTable()
      .where('contract', contract.id)
      .andWhere('wallet', wallet.id)
      .first();
    if (duplicate) return duplicate;

    const created = {
      id: uuid(),
      contract: contract.id,
      wallet: wallet.id,
      createdAt: new Date(),
    };
    await this.walletLinkTable().insert(created);
    this.onWalletLink.emit({ contract, wallet, link: created });

    return created;
  }

  async walletUnlink(contract: Contract, wallet: Wallet) {
    const duplicate = await this.walletLinkTable()
      .where('contract', contract.id)
      .andWhere('wallet', wallet.id)
      .first();
    if (!duplicate) return;

    await this.walletLinkTable().where('id', duplicate.id).delete();
  }
}
