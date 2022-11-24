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

  public readonly onBillCreated = new Emitter<Bill>((bill) => {
    return container.model.queueService().push('billingBillStatusResolver', { id: bill.id });
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

  async updateTrasfer(transfer: Transfer, state: Partial<Transfer>) {
    await this.transferTable().update(state).where('id', transfer.id);
    const updated: Transfer = {
      ...transfer,
      ...state,
      updatedAt: new Date(),
    };
    this.onTransferUpdated.emit(updated);

    return updated;
  }

  transferConfirm(transfer: Transfer, amount: BN, createdAt: Date) {
    return this.updateTrasfer(transfer, {
      amount: amount.toPrecision(15, BN.ROUND_FLOOR),
      status: TransferStatus.Confirmed,
      createdAt,
    });
  }

  transferReject(transfer: Transfer, reason: string) {
    return this.updateTrasfer(transfer, {
      status: TransferStatus.Rejected,
      rejectReason: reason,
    });
  }

  async claim(
    billId: string | number,
    blockchain: Blockchain,
    network: string,
    account: string,
    claimant: string,
    gasFee: BN,
    protocolFee: BN,
    description: string,
    tx: string,
  ) {
    const created: Bill = {
      id: uuid(),
      number: Number(billId),
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
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.billTable().insert(created);
    this.onBillCreated.emit(created);

    return created;
  }

  async updateClaim(bill: Bill, state: Partial<Bill>): Promise<Bill> {
    await this.billTable().where({ id: bill.id }).update(state);
    return {
      ...bill,
      ...state,
      updatedAt: new Date(),
    };
  }

  async acceptBill(bill: Bill, gasFee: BN, protocolFee: BN) {
    const updated = await this.updateClaim(bill, {
      gasFee: gasFee.toPrecision(15, BN.ROUND_FLOOR),
      protocolFee: protocolFee.toPrecision(15, BN.ROUND_FLOOR),
      claim: '0',
      status: BillStatus.Accepted,
    });
    const transferFee = await this.transfer(
      bill.blockchain,
      bill.network,
      bill.account,
      gasFee.plus(protocolFee).multipliedBy(-1),
      bill.tx,
      true,
      bill.createdAt,
      updated,
    );

    return { updated, transferFee };
  }

  rejectBill(bill: Bill) {
    return this.updateClaim(bill, {
      claim: '0',
      status: BillStatus.Rejected,
    });
  }
}
