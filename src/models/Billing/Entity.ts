import { tableFactoryLegacy } from '@services/Database';
import { Blockchain } from '@models/types';

export interface Transfer {
  id: string;
  blockchain: Blockchain;
  network: string;
  account: string;
  amount: number;
  tx: string;
  bill: string | null;
  confirmed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const transferTableName = 'billing_transfer';

export const transferTableFactory = tableFactoryLegacy<Transfer>(transferTableName);

export type TransferTable = ReturnType<ReturnType<typeof transferTableFactory>>;

export enum BillStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Rejected = 'rejected',
}

export interface Bill {
  id: string;
  number: number;
  blockchain: Blockchain;
  network: string;
  account: string;
  claimant: string;
  claimGasFee: number;
  claimProtocolFee: number;
  gasFee: number | null;
  protocolFee: number | null;
  claim: number;
  description: string;
  status: BillStatus;
  tx: string;
  processTx: string | null;
  updatedAt: Date;
  createdAt: Date;
}

export const billTableName = 'billing_bill';

export const billTableFactory = tableFactoryLegacy<Bill>(billTableName);

export type BillTable = ReturnType<ReturnType<typeof billTableFactory>>;
