import container from '@container';
import BN from 'bignumber.js';

export default async () => {
  const transfers = await container.model.billingTransferTable();
  await transfers.reduce<Promise<unknown>>(async (prev, transfer) => {
    await prev;

    return container.model
      .billingTransferTable()
      .update({ amount: new BN(transfer.amount).toPrecision(8, BN.ROUND_FLOOR) })
      .where('id', transfer.id);
  }, Promise.resolve(null));

  const bills = await container.model.billingBillTable();
  await bills.reduce<Promise<unknown>>(async (prev, bill) => {
    await prev;

    return container.model
      .billingBillTable()
      .update({
        claimGasFee: new BN(bill.claimGasFee).toPrecision(8, BN.ROUND_FLOOR),
        claimProtocolFee: new BN(bill.claimProtocolFee).toPrecision(8, BN.ROUND_FLOOR),
        gasFee: bill.gasFee ? new BN(bill.gasFee).toPrecision(8, BN.ROUND_FLOOR) : null,
        protocolFee: bill.protocolFee
          ? new BN(bill.protocolFee).toPrecision(8, BN.ROUND_FLOOR)
          : null,
        claim: new BN(bill.claim).toPrecision(8, BN.ROUND_FLOOR),
      })
      .where('id', bill.id);
  }, Promise.resolve(null));
};
