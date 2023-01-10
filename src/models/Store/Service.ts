import { Blockchain } from '@models/types';
import { v4 as uuid } from 'uuid';
import { Factory } from '@services/Container';
import { User } from '@models/User/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import { Query as NotificationQuery } from '@models/Notification/Service';
import {
  NotificationTable,
  notificationTableName,
  userContactTableName,
} from '@models/Notification/Entity';
import {
  Product,
  ProductCode,
  productTableName,
  ProductTable,
  Purchase,
  PurchaseTable,
  purchaseTableName,
} from './Entity';

export namespace Query {
  export function purchaseJoinWallet(qb: PurchaseTable) {
    qb.innerJoin(walletBlockchainTableName, function () {
      this.on(`${walletBlockchainTableName}.blockchain`, '=', `${purchaseTableName}.blockchain`);
      this.on(`${walletBlockchainTableName}.network`, '=', `${purchaseTableName}.network`);
      this.on(`${walletBlockchainTableName}.address`, '=', `${purchaseTableName}.account`);
    });
    qb.innerJoin(walletTableName, `${walletTableName}.id`, `${walletBlockchainTableName}.id`);
  }

  export function purchaseAmount(qb: PurchaseTable, alias: string = 'sum') {
    qb.sum({ [alias]: `${purchaseTableName}.amount` });
  }
}

export class StoreService {
  constructor(
    readonly productTable: Factory<ProductTable>,
    readonly purchaseTable: Factory<PurchaseTable>,
    readonly notificationTable: Factory<NotificationTable>,
  ) {}

  async create(
    number: number,
    code: ProductCode,
    name: string,
    description: string,
    priceUSD: number,
    amount: number,
  ) {
    const created: Product = {
      id: uuid(),
      number,
      code,
      name,
      description,
      priceUSD,
      amount,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.productTable().insert(created);

    return created;
  }

  async update(product: Product) {
    const updated = {
      ...product,
      updatedAt: new Date(),
    };
    await this.productTable().where({ id: product.id }).update(updated);

    return updated;
  }

  async delete(product: Product) {
    await this.productTable().where({ id: product.id }).delete();
  }

  async purchase(
    product: Product,
    blockchain: Blockchain,
    network: string,
    number: number,
    account: string,
    amount: number,
    tx: string,
    createdAt: Date,
  ) {
    const created: Purchase = {
      id: uuid(),
      product: product.id,
      blockchain,
      network,
      number,
      account,
      amount,
      tx,
      createdAt,
    };
    await this.purchaseTable().insert(created);

    return created;
  }

  purchaseAmount(code: ProductCode, user: User): Promise<number> {
    return this.purchaseTable()
      .modify(Query.purchaseAmount)
      .modify(Query.purchaseJoinWallet)
      .innerJoin(productTableName, `${purchaseTableName}.product`, '=', `${productTableName}.id`)
      .where(`${productTableName}.code`, code)
      .where(`${walletTableName}.user`, user.id)
      .first()
      .then((row) => row ?? { sum: 0 })
      .then(({ sum }) => Number(sum));
  }

  async availableNotifications(user: User): Promise<number> {
    const [purchaseAmount, notificationsCount] = await Promise.all([
      this.purchaseAmount(ProductCode.Notification, user),
      this.notificationTable()
        .modify(NotificationQuery.notificationCount)
        .innerJoin(
          userContactTableName,
          `${userContactTableName}.id`,
          `${notificationTableName}.contact`,
        )
        .where(`${userContactTableName}.user`, user.id)
        .first()
        .then((row) => row ?? { count: 0 })
        .then(({ count }) => Number(count)),
    ]);

    return purchaseAmount - notificationsCount;
  }
}
