import { Blockchain } from '@models/types';
import { v4 as uuid } from 'uuid';
import { Factory } from '@services/Container';
import { Emitter } from '@services/Event';
import container from '@container';
import { Bill, BillStatus, BillTable, Transfer, TransferTable } from './Entity';

export class BillingService {
  public readonly onTransferCreated = new Emitter<Transfer>(async (transfer) => {
    container.cache().publish(
      'defihelper:channel:onBillingTransferCreated',
      JSON.stringify({
        id: transfer.id,
      }),
    );
  });

  constructor(
    readonly billTable: Factory<BillTable>,
    readonly transferTable: Factory<TransferTable>,
  ) {}

  async transfer(
    blockchain: Blockchain,
    network: string,
    account: string,
    amount: number,
    tx: string,
    createdAt: Date,
    bill: Bill | null = null,
  ) {
    const created: Transfer = {
      id: uuid(),
      blockchain,
      network,
      account,
      amount,
      tx,
      bill: bill?.id || null,
      createdAt,
    };
    await this.transferTable().insert(created);
    this.onTransferCreated.emit(created);

    return created;
  }

  async claim(
    billId: number,
    blockchain: Blockchain,
    network: string,
    account: string,
    claimant: string,
    gasFee: number,
    protocolFee: number,
    description: string,
    tx: string,
    createdAt: Date,
  ) {
    const created: Bill = {
      id: uuid(),
      number: billId,
      blockchain,
      network,
      account,
      claimant,
      claimGasFee: gasFee,
      claimProtocolFee: protocolFee,
      gasFee: null,
      protocolFee: null,
      claim: gasFee + protocolFee,
      status: BillStatus.Pending,
      description,
      tx,
      processTx: null,
      createdAt,
      updatedAt: createdAt,
    };
    await this.billTable().insert(created);

    return created;
  }

  async acceptBill(bill: Bill, gasFee: number, protocolFee: number, tx: string, updatedAt: Date) {
    const updated: Bill = {
      ...bill,
      gasFee,
      protocolFee,
      claim: 0,
      status: BillStatus.Accepted,
      processTx: tx,
      updatedAt,
    };
    await this.billTable().where({ id: bill.id }).update(updated);

    const transferFee = await this.transfer(
      bill.blockchain,
      bill.network,
      bill.account,
      -(gasFee + protocolFee),
      tx,
      updatedAt,
      updated,
    );

    return { updated, transferFee };
  }

  async rejectBill(bill: Bill, tx: string, updatedAt: Date) {
    const updated: Bill = {
      ...bill,
      claim: 0,
      status: BillStatus.Rejected,
      processTx: tx,
      updatedAt,
    };
    await this.billTable().where({ id: bill.id }).update(updated);

    return updated;
  }
}
