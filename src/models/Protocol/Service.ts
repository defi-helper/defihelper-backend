import container from '@container';
import { Token } from '@models/Token/Entity';
import { Blockchain } from '@models/types';
import { User } from '@models/User/Entity';
import { WalletBlockchain } from '@models/Wallet/Entity';
import { Factory } from '@services/Container';
import { Emitter } from '@services/Event';
import { v4 as uuid } from 'uuid';
import Knex from 'knex';
import { Tag, tagTableName, TagType } from '@models/Tag/Entity';
import {
  Protocol,
  ProtocolTable,
  Contract,
  ContractTable,
  WalletContractLinkTable,
  ProtocolLinkMap,
  ProtocolUserFavoriteTable,
  MetadataTable,
  MetadataType,
  ContractBlockchainTable,
  ContractDebankTable,
  ContractMetric,
  ContractDebankType,
  ContractBlockchainType,
  TokenContractLinkTable,
  TokenContractLinkType,
  ContractAutomate,
  TokenContractLink,
  UserContractLinkTable,
  UserContractLink,
  UserContractLinkType,
  ContractMigratableRemindersBulkTable,
  ContractMigratableRemindersBulk,
  TagContractLinkTable,
  TagContractLink,
  tagContractLinkTableName,
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
  public readonly onContractDebankCreated = new Emitter<
    Readonly<{
      contract: Contract;
      contractDebank: ContractDebankType;
    }>
  >();

  public readonly onContractBlockchainCreated = new Emitter<Readonly<ContractRegisterData>>(
    (contract) => {
      container.model.queueService().push('eventsContractBlockchainCreated', {
        contract: contract.contract.id,
        events: contract.eventsToSubscribe,
      });
    },
  );

  public readonly onContractBlockchainUpdated = new Emitter<
    Readonly<ContractBlockchainType & Contract>
  >((contract) => {
    container.model.queueService().push('eventsContractBlockchainUpdated', {
      contract: contract.id,
    });
  });

  public readonly onWalletLink = new Emitter<{
    contract: Contract;
    wallet: WalletBlockchain;
  }>(({ contract, wallet }) => {
    container.model
      .queueService()
      .push('eventsWalletContractLinked', { contractId: contract.id, walletId: wallet.id });
  });

  constructor(
    readonly database: Knex,
    readonly contractTable: Factory<ContractTable>,
    readonly contractMigratableRemindersBulkTable: Factory<ContractMigratableRemindersBulkTable>,
    readonly contractBlockchainTable: Factory<ContractBlockchainTable>,
    readonly contractDebankTable: Factory<ContractDebankTable>,
    readonly walletLinkTable: Factory<WalletContractLinkTable>,
    readonly tokenLinkTable: Factory<TokenContractLinkTable>,
    readonly userLinkTable: Factory<UserContractLinkTable>,
    readonly tagLinkTable: Factory<TagContractLinkTable>,
  ) {}

  async linkTag(contract: Contract, tag: Tag): Promise<void> {
    const existing = await this.tagLinkTable()
      .where({
        contract: contract.id,
        tag: tag.id,
      })
      .first();

    if (existing) {
      return;
    }

    const created: TagContractLink = {
      id: uuid(),
      tag: tag.id,
      contract: contract.id,
      createdAt: new Date(),
    };
    await this.tagLinkTable().insert(created);
  }

  async unlinkTag(contract: Contract, tag: Tag): Promise<void> {
    await this.tagLinkTable()
      .where({
        contract: contract.id,
        tag: tag.id,
      })
      .delete();
  }

  async unlinkAllTagsByType(contract: Contract, type: TagType): Promise<void> {
    await this.tagLinkTable()
      .whereIn(
        'id',
        container.model
          .tagContractLinkTable()
          .column(`${tagContractLinkTableName}.id`)
          .innerJoin(tagTableName, `${tagTableName}.id`, `${tagContractLinkTableName}.tag`)
          .whereRaw(`${tagTableName}.type = ?`, [type])
          .andWhere('contract', contract.id),
      )
      .delete();
  }

  async scheduleMigrationReminder(
    contract: Contract,
    wallet: WalletBlockchain,
  ): Promise<ContractMigratableRemindersBulk> {
    const existing = await this.contractMigratableRemindersBulkTable()
      .where({
        contract: contract.id,
        wallet: wallet.id,
      })
      .first();

    if (existing) {
      if (existing.processed === true) {
        const updatedInstance = {
          ...existing,
          processed: false,
          updatedAt: new Date(),
        };
        await this.contractMigratableRemindersBulkTable()
          .where('id', existing.id)
          .update(updatedInstance);

        return updatedInstance;
      }

      return existing;
    }

    const created: ContractMigratableRemindersBulk = {
      id: uuid(),
      wallet: wallet.id,
      contract: contract.id,
      processed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.contractMigratableRemindersBulkTable().insert(created);

    return created;
  }

  async doneMigrationReminder(contract: Contract, wallet: WalletBlockchain): Promise<void> {
    const existing = await this.contractMigratableRemindersBulkTable()
      .where({
        contract: contract.id,
        wallet: wallet.id,
      })
      .first();

    if (!existing) {
      throw new Error(`No reminders found`);
    }

    if (existing.processed === true) {
      return;
    }

    const updatedInstance = {
      ...existing,
      processed: true,
      updatedAt: new Date(),
    };
    await this.contractMigratableRemindersBulkTable()
      .where('id', existing.id)
      .update(updatedInstance);
  }

  async createDebank(
    { id: protocol }: Protocol,
    hashAddress: string,
    name: string,
    metric: ContractMetric,
    description: string = '',
    link: string | null = null,
    hidden: boolean = false,
  ) {
    const parentContract: Contract = {
      id: uuid(),
      description,
      hidden,
      deprecated: false,
      layout: 'debank',
      link,
      name,
      protocol,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const childContract: ContractDebankType = {
      id: parentContract.id,
      address: hashAddress,
      metric,
    };

    await this.database.transaction(async (trx) => {
      await this.contractTable().insert(parentContract).transacting(trx);
      await this.contractDebankTable().insert(childContract).transacting(trx);
    });

    this.onContractDebankCreated.emit({
      contract: parentContract,
      contractDebank: childContract,
    });

    return { ...parentContract, ...childContract };
  }

  async createBlockchain(
    { id: protocol }: Protocol,
    blockchain: Blockchain,
    network: string,
    address: string,
    deployBlockNumber: string | null,
    adapter: string,
    layout: string,
    automate: ContractAutomate,
    metric: ContractMetric,
    name: string,
    description: string = '',
    link: string | null = null,
    hidden: boolean = false,
    eventsToSubscribe?: string[],
  ) {
    const parentContract: Contract = {
      id: uuid(),
      description,
      hidden,
      deprecated: false,
      layout,
      link,
      name,
      protocol,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const childContract: ContractBlockchainType = {
      id: parentContract.id,
      adapter,
      address: blockchain === 'ethereum' ? address.toLowerCase() : address,
      automate: {
        adapters: automate.adapters,
        autorestakeAdapter: automate.autorestakeAdapter,
        lpTokensManager: automate.lpTokensManager,
      },
      blockchain,
      deployBlockNumber,
      watcherId: null,
      metric,
      network,
    };

    await this.database.transaction(async (trx) => {
      await this.contractTable().insert(parentContract).transacting(trx);
      await this.contractBlockchainTable().insert(childContract).transacting(trx);
    });

    this.onContractBlockchainCreated.emit({
      contract: { ...parentContract, ...childContract },
      eventsToSubscribe,
    });

    return { ...parentContract, ...childContract };
  }

  async updateBlockchain(contractBlockchain: ContractBlockchainType & Contract) {
    const updatedBlockchain: ContractBlockchainType = {
      ...contractBlockchain,
      address:
        contractBlockchain.blockchain === 'ethereum'
          ? contractBlockchain.address.toLowerCase()
          : contractBlockchain.address,
    };

    await this.database.transaction(async (trx) => {
      await this.contractTable()
        .where('id', updatedBlockchain.id)
        .update({
          id: contractBlockchain.id,
          protocol: contractBlockchain.protocol,
          layout: contractBlockchain.layout,
          name: contractBlockchain.name,
          description: contractBlockchain.description,
          link: contractBlockchain.link,
          hidden: contractBlockchain.hidden,
          deprecated: contractBlockchain.deprecated,
          updatedAt: new Date(),
          createdAt: contractBlockchain.createdAt,
        })
        .transacting(trx);
      await this.contractBlockchainTable().where('id', updatedBlockchain.id).update({
        id: updatedBlockchain.id,
        blockchain: updatedBlockchain.blockchain,
        network: updatedBlockchain.network,
        address: updatedBlockchain.address,
        deployBlockNumber: updatedBlockchain.deployBlockNumber,
        watcherId: updatedBlockchain.watcherId,
        adapter: updatedBlockchain.adapter,
        automate: updatedBlockchain.automate,
        metric: updatedBlockchain.metric,
      });
    });

    this.onContractBlockchainUpdated.emit(contractBlockchain);

    return updatedBlockchain;
  }

  async updateDebank(contractDebank: ContractDebankType & Contract) {
    await this.database.transaction(async (trx) => {
      await this.contractTable()
        .where('id', contractDebank.id)
        .update({
          id: contractDebank.id,
          protocol: contractDebank.protocol,
          layout: contractDebank.layout,
          name: contractDebank.name,
          description: contractDebank.description,
          link: contractDebank.link,
          hidden: contractDebank.hidden,
          updatedAt: new Date(),
          createdAt: contractDebank.createdAt,
        })
        .transacting(trx);
      await this.contractDebankTable().where('id', contractDebank.id).update({
        id: contractDebank.id,
        address: contractDebank.address,
        metric: contractDebank.metric,
      });
    });

    return contractDebank;
  }

  async delete(contract: Contract) {
    await this.contractTable().where({ id: contract.id }).delete();
  }

  async walletLink(contract: Contract, blockchainWallet: WalletBlockchain) {
    const created = {
      id: uuid(),
      contract: contract.id,
      wallet: blockchainWallet.id,
      createdAt: new Date(),
    };
    const insert = await this.walletLinkTable()
      .insert([created], ['id'])
      .onConflict(['contract', 'wallet'])
      .ignore();
    if (insert.length > 0) {
      this.onWalletLink.emit({ contract, wallet: blockchainWallet });
    }

    return created;
  }

  async walletUnlink(contract: Contract, wallet: WalletBlockchain) {
    await this.walletLinkTable()
      .where({
        contract: contract.id,
        wallet: wallet.id,
      })
      .delete();
  }

  async tokenLink(
    contract: Contract,
    tokens: Array<{ token: Token; type: TokenContractLinkType }>,
  ) {
    const duplicates = await this.tokenLinkTable()
      .where('contract', contract.id)
      .then(
        (rows) =>
          new Map(rows.map((duplicate) => [`${duplicate.token}:${duplicate.type}`, duplicate])),
      );

    return Promise.all(
      tokens.map(async ({ token, type }) => {
        const duplicate = duplicates.get(`${token.id}:${type}`);
        if (duplicate) return duplicate;

        const created: TokenContractLink = {
          id: uuid(),
          contract: contract.id,
          token: token.id,
          type,
          createdAt: new Date(),
        };
        await this.tokenLinkTable().insert(created);

        return created;
      }),
    );
  }

  async userLink(contract: Contract, users: Array<{ user: User; type: UserContractLinkType }>) {
    const duplicates = await this.userLinkTable()
      .where('contract', contract.id)
      .then(
        (rows) =>
          new Map(rows.map((duplicate) => [`${duplicate.user}:${duplicate.type}`, duplicate])),
      );

    return Promise.all(
      users.map(async ({ user, type }) => {
        const duplicate = duplicates.get(`${user.id}:${type}`);
        if (duplicate) return duplicate;

        const created: UserContractLink = {
          id: uuid(),
          contract: contract.id,
          user: user.id,
          type,
          createdAt: new Date(),
        };
        await this.userLinkTable().insert(created);

        return created;
      }),
    );
  }

  async userUnlink(contract: Contract, users: Array<{ user: User; type: UserContractLinkType }>) {
    await this.userLinkTable()
      .where(function () {
        this.where('contract', contract.id);
        this.where(function () {
          users.forEach(({ user, type }) =>
            this.orWhere(function () {
              this.where('user', user.id).where('type', type);
            }),
          );
        });
      })
      .delete();
  }
}

export class MetadataService {
  constructor(readonly metadataTable: Factory<MetadataTable>) {}

  async createOrUpdate(
    type: MetadataType,
    value: any,
    blockchain: string,
    network: string,
    address: string,
  ) {
    const actualRow = await this.metadataTable()
      .where({
        blockchain,
        network,
        address,
        type,
      })
      .first();

    if (!actualRow) {
      const v = {
        id: uuid(),
        type,
        value: { value },
        blockchain,
        network,
        address,
        createdAt: new Date(),
      };

      await this.metadataTable().insert(v);
      return v;
    }

    await this.metadataTable()
      .where({
        blockchain,
        network,
        address,
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
