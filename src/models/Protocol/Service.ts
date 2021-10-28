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
  ProtocolLinkMap,
} from './Entity';

export class ProtocolService {
  constructor(readonly table: Factory<ProtocolTable>) {}

  async create(
    adapter: string,
    name: string,
    description: string = '',
    icon: string | null = null,
    link: string | null = null,
    links: ProtocolLinkMap = {},
    hidden: boolean = false,
  ) {
    const created = {
      id: uuid(),
      adapter,
      name,
      description,
      icon,
      link,
      links,
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

interface ContractRegisterData {
  contract: Contract;
  eventsToSubscribe?: string[];
}

export class ContractService {
  public readonly onCreated = new Emitter<ContractRegisterData>((contract) =>
    container.model.queueService().push('eventsContractCreated', {
      contract: contract.contract.id,
      events: contract.eventsToSubscribe,
    }),
  );

  public readonly onWalletLink = new Emitter<{
    contract: Contract;
    wallet: Wallet;
    link: WalletContractLink;
  }>(({ contract, link }) => {
    if (
      !(contract.blockchain === 'ethereum' && ['1', '56'].includes(contract.network)) ||
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
    automateAdapters: string[],
    name: string,
    description: string = '',
    link: string | null = null,
    hidden: boolean = false,
    eventsToSubscribe?: string[],
  ) {
    const created = {
      id: uuid(),
      protocol: protocol.id,
      blockchain,
      network,
      address: blockchain === 'ethereum' ? address.toLowerCase() : address,
      deployBlockNumber,
      adapter,
      layout,
      automate: {
        adapters: automateAdapters,
      },
      name,
      description,
      link,
      hidden,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.contractTable().insert(created);
    this.onCreated.emit({
      contract: created,
      eventsToSubscribe,
    });

    return created;
  }

  async update(contract: Contract) {
    const updated = {
      ...contract,
      address:
        contract.blockchain === 'ethereum' ? contract.address.toLowerCase() : contract.address,
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
