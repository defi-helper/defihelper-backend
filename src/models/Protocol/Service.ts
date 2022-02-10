import container from '@container';
import { Blockchain } from '@models/types';
import { User } from '@models/User/Entity';
import { Wallet, WalletBlockchain } from '@models/Wallet/Entity';
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
  ProtocolUserFavoriteTable,
  MetadataTable,
  MetadataType,
} from './Entity';

export class ProtocolService {
  constructor(
    readonly protocolTable: Factory<ProtocolTable>,
    readonly protocolFavoriteTable: Factory<ProtocolUserFavoriteTable>,
  ) {}

  async create(
    adapter: string,
    name: string,
    description: string = '',
    icon: string | null = null,
    previewPicture: string | null = null,
    link: string | null = null,
    links: ProtocolLinkMap = {},
    hidden: boolean = false,
    metric: { tvl?: string } = {},
    debankId: string | null = null,
  ) {
    const created = {
      id: uuid(),
      adapter,
      name,
      description,
      icon,
      previewPicture,
      link,
      links,
      hidden,
      metric,
      debankId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.protocolTable().insert(created);

    return created;
  }

  async update(protocol: Protocol) {
    const updated = {
      ...protocol,
      updatedAt: new Date(),
    };
    await this.protocolTable().where({ id: protocol.id }).update(updated);

    return updated;
  }

  async delete(protocol: Protocol) {
    await this.protocolTable().where({ id: protocol.id }).delete();
  }

  async addFavorite(protocol: Protocol, user: User) {
    const duplicate = await this.protocolFavoriteTable()
      .where({ protocol: protocol.id, user: user.id })
      .first();
    if (duplicate) return duplicate;

    const created = {
      id: uuid(),
      protocol: protocol.id,
      user: user.id,
      createdAt: new Date(),
    };
    await this.protocolFavoriteTable().insert(created);

    return created;
  }

  async removeFavorite(protocol: Protocol, user: User) {
    await this.protocolFavoriteTable()
      .where({ protocol: protocol.id, user: user.id })
      .delete()
      .limit(1);
  }
}

interface ContractRegisterData {
  contract: Contract;
  eventsToSubscribe?: string[];
}

export class ContractService {
  public readonly onCreated = new Emitter<ContractRegisterData>((contract) => {
    if (contract.contract.debankAddress) {
      return;
    }

    container.model.queueService().push('eventsContractCreated', {
      contract: contract.contract.id,
      events: contract.eventsToSubscribe,
    });
  });

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

    return Promise.all([
      container.model
        .queueService()
        .push('metricsWalletHistory', { contract: link.contract, wallet: link.wallet }),
      container.model
        .queueService()
        .push('metricsWalletCurrent', { contract: link.contract, wallet: link.wallet }),
    ]);
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
    automate: {
      adapters: string[];
      autorestakeAdapter?: string;
    },
    name: string,
    description: string = '',
    link: string | null = null,
    hidden: boolean = false,
    eventsToSubscribe?: string[],
    debankAddress: string | null = null,
  ) {
    const created: Contract = {
      id: uuid(),
      protocol: protocol.id,
      blockchain,
      network,
      address: blockchain === 'ethereum' ? address.toLowerCase() : address,
      deployBlockNumber,
      adapter,
      layout,
      debankAddress,
      automate: {
        adapters: automate.adapters,
        autorestakeAdapter: automate.autorestakeAdapter,
      },
      name,
      description,
      link,
      hidden,
      metric: {},
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
    const updated: Contract = {
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

  async walletLink(contract: Contract, blockchainWallet: Wallet & WalletBlockchain) {
    const duplicate = await this.walletLinkTable()
      .where('contract', contract.id)
      .andWhere('wallet', blockchainWallet.id)
      .first();
    if (duplicate) return duplicate;

    const created = {
      id: uuid(),
      contract: contract.id,
      wallet: blockchainWallet.id,
      createdAt: new Date(),
    };
    await this.walletLinkTable().insert(created);
    this.onWalletLink.emit({ contract, wallet: blockchainWallet, link: created });

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

export class MetadataService {
  constructor(readonly metadataTable: Factory<MetadataTable>) {}

  async createOrUpdate(contract: Contract, type: MetadataType, value: any) {
    const actualRow = await this.metadataTable()
      .where({
        contract: contract.id,
        type,
      })
      .first();

    if (!actualRow) {
      const v = {
        id: uuid(),
        type,
        contract: contract.id,
        value: { value },
        createdAt: new Date(),
      };

      await this.metadataTable().insert(v);
      return v;
    }

    await this.metadataTable()
      .where({
        contract: contract.id,
        type,
      })
      .update({
        ...actualRow,
        value: { value },
      });

    return {
      ...actualRow,
      value: { value },
    };
  }
}
