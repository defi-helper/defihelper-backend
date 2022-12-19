import { tableFactoryLegacy } from '@services/Database';
import { Blockchain } from '@models/types';

export enum ProductCode {
  Notification = 'notification',
}

export interface Product {
  id: string;
  number: number;
  code: ProductCode;
  name: string;
  description: string;
  priceUSD: number;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
}

export const productTableName = 'store_product';

export const productTableFactory = tableFactoryLegacy<Product>(productTableName);

export type ProductTable = ReturnType<ReturnType<typeof productTableFactory>>;

export interface Purchase {
  id: string;
  product: string;
  blockchain: Blockchain;
  number: number;
  network: string;
  account: string;
  amount: number;
  tx: string;
  createdAt: Date;
}

export const purchaseTableName = 'store_purchase';

export const purchaseTableFactory = tableFactoryLegacy<Purchase>(purchaseTableName);

export type PurchaseTable = ReturnType<ReturnType<typeof purchaseTableFactory>>;
