import container from '@container';
import { ProductCode, purchaseTableName } from '@models/Store/Entity';
import { User, tableName as userTableName } from '@models/User/Entity';
import { walletTableName, walletBlockchainTableName } from '@models/Wallet/Entity';

export default async () => {
  const notificationProduct = await container.model
    .storeProductTable()
    .where({
      code: ProductCode.Notification,
      number: 0,
    })
    .first();
  if (!notificationProduct) return;

  const candidates = await container.model
    .userTable()
    .column<User[]>(`${userTableName}.*`)
    .whereRaw(
      `(${container.model
        .walletTable()
        .countDistinct(`${walletTableName}.id`)
        .innerJoin(
          walletBlockchainTableName,
          `${walletTableName}.id`,
          `${walletBlockchainTableName}.id`,
        )
        .innerJoin(purchaseTableName, function () {
          this.on(`${walletBlockchainTableName}.blockchain`, `${purchaseTableName}.blockchain`);
          this.on(`${walletBlockchainTableName}.network`, `${purchaseTableName}.network`);
          this.on(`${walletBlockchainTableName}.address`, `${purchaseTableName}.account`);
        })
        .whereRaw(`"${walletTableName}"."user" = "${userTableName}"."id"`)
        .where(`${purchaseTableName}.product`, notificationProduct.id)
        .toQuery()}) = 0`,
    );
  await candidates.reduce<Promise<unknown>>(async (prev, user) => {
    await prev;

    const firstBlockchainWallet = await container.model
      .walletTable()
      .innerJoin(
        walletBlockchainTableName,
        `${walletBlockchainTableName}.id`,
        `${walletTableName}.id`,
      )
      .where(`${walletTableName}.user`, user.id)
      .whereNull(`${walletTableName}.deletedAt`)
      .first();
    if (!firstBlockchainWallet) return null;
    return container.model
      .storeService()
      .purchase(
        notificationProduct,
        firstBlockchainWallet.blockchain,
        firstBlockchainWallet.network,
        0,
        firstBlockchainWallet.address,
        notificationProduct.amount,
        '',
        new Date(),
      );
  }, Promise.resolve(null));
};
