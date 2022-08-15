import { Blockchain } from '@models/types';
import { v4 as uuid } from 'uuid';
import { Factory } from '@services/Container';
import { Emitter } from '@services/Event';
import container from '@container';
import { WalletBlockchain } from '@models/Wallet/Entity';
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
    amount: number,
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
      amount,
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

  async transferConfirm(transfer: Transfer, amount: number, createdAt: Date) {
    const updated: Transfer = {
      ...transfer,
      amount,
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

  balanceOf(blockchain: Blockchain, network: string, account: string) {
    return this.transferTable()
      .sum('amount')
      .where({
        blockchain,
        network,
        account,
      })
      .where('confirmed', true)
      .first()
      .then((row) => row ?? { sum: 0 })
      .then(({ sum }) => Number(sum));
  }

  balanceOfWallet({ blockchain, network, address }: WalletBlockchain) {
    return this.balanceOf(blockchain, network, address.toLowerCase());
  }

  claimOf(blockchain: Blockchain, network: string, account: string) {
    return this.billTable()
      .sum('claim')
      .where({
        blockchain,
        network,
        account,
      })
      .where('status', BillStatus.Accepted)
      .first()
      .then((row) => row ?? { sum: 0 })
      .then(({ sum }) => Number(sum));
  }

  claimOfWallet({ blockchain, network, address }: WalletBlockchain) {
    return this.claimOf(blockchain, network, address.toLowerCase());
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
      true,
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
