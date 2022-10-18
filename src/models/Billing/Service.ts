import { Blockchain } from '@models/types';
import { v4 as uuid } from 'uuid';
import BN from 'bignumber.js';
import { Factory } from '@services/Container';
import { Emitter } from '@services/Event';
import container from '@container';
import { Bill, BillStatus, BillTable, Transfer, TransferStatus, TransferTable } from './Entity';

export class BillingService {
  public readonly onTransferCreated = new Emitter<Transfer>(async (transfer) => {
    container.cache().publish(
      'defihelper:channel:onBillingTransferCreated',
      JSON.stringify({
        id: transfer.id,
      }),
    );
    if (transfer.blockchain === 'ethereum' && transfer.status === TransferStatus.Pending) {
      container.model.queueService().push('eventsBillingTransferTxCreated', { id: transfer.id });
    }
  });

  public readonly onTransferUpdated = new Emitter<Transfer>(async (transfer) => {
    container.cache().publish(
      'defihelper:channel:onBillingTransferUpdated',
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
    amount: BN,
    tx: string,
    confirmed: boolean,
    createdAt: Date,
    bill: Bill | null = null,
  ) {
    const created: Transfer = {
      id: uuid(),
      blockchain,
      network,
      account,
      amount: amount.toPrecision(15, BN.ROUND_FLOOR),
      tx,
      status: confirmed ? TransferStatus.Confirmed : TransferStatus.Pending,
      rejectReason: '',
      bill: bill?.id || null,
      createdAt,
      updatedAt: createdAt,
    };
    await this.transferTable().insert(created);
    this.onTransferCreated.emit(created);

    return created;
  }

  async transferConfirm(transfer: Transfer, amount: BN, createdAt: Date) {
    const updated: Transfer = {
      ...transfer,
      amount: amount.toPrecision(15, BN.ROUND_FLOOR),
      status: TransferStatus.Confirmed,
      createdAt,
      updatedAt: new Date(),
    };
    await this.transferTable().update(updated).where('id', updated.id);
    this.onTransferUpdated.emit(updated);

    return updated;
  }

  async transferReject(transfer: Transfer, reason: string) {
    const updated: Transfer = {
      ...transfer,
      status: TransferStatus.Rejected,
      rejectReason: reason,
      updatedAt: new Date(),
    };
    await this.transferTable().update(updated).where('id', updated.id);
    this.onTransferUpdated.emit(updated);

    return updated;
  }

  async claim(
    billId: number,
    blockchain: Blockchain,
    network: string,
    account: string,
    claimant: string,
    gasFee: BN,
    protocolFee: BN,
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
      claimGasFee: gasFee.toPrecision(15, BN.ROUND_FLOOR),
      claimProtocolFee: protocolFee.toPrecision(15, BN.ROUND_FLOOR),
      gasFee: null,
      protocolFee: null,
      claim: gasFee.plus(protocolFee).toPrecision(15, BN.ROUND_FLOOR),
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

  async acceptBill(bill: Bill, gasFee: BN, protocolFee: BN, tx: string, updatedAt: Date) {
    const updated: Bill = {
      ...bill,
      gasFee: gasFee.toPrecision(15, BN.ROUND_FLOOR),
      protocolFee: protocolFee.toPrecision(15, BN.ROUND_FLOOR),
      claim: '0',
      status: BillStatus.Accepted,
      processTx: tx,
      updatedAt,
    };
    await this.billTable().where({ id: bill.id }).update(updated);

    const transferFee = await this.transfer(
      bill.blockchain,
      bill.network,
      bill.account,
      gasFee.plus(protocolFee).multipliedBy(-1),
      tx,
      true,
      updatedAt,
      updated,
    );

    return { updated, transferFee };
  }

  async rejectBill(bill: Bill, tx: string, updatedAt: Date) {
    const updated: Bill = {
      ...bill,
      claim: '0',
      status: BillStatus.Rejected,
      processTx: tx,
      updatedAt,
    };
    await this.billTable().where({ id: bill.id }).update(updated);

    return updated;
  }
}
