import BN from 'bignumber.js';
import { Bill, BillStatus } from '@models/Billing/Entity';
import container from '@container';
import dayjs from 'dayjs';
import { Process } from '@models/Queue/Entity';
import { Blockchain } from '@models/types';
import { isKey } from '@services/types';
import { abi as balanceAbi } from '@defihelper/networks/abi/Balance.json';
import contracts from '@defihelper/networks/contracts.json';
import { LogJsonMessage } from '@services/Log';

const ethFeeDecimals = new BN(10).pow(18);

interface ProcessedBill {
  bill: Bill;
  gasFee: BN;
  protocolFee: BN;
  accept: boolean;
}

export interface Params {
  blockchain: Blockchain;
  network: string;
}

export default async (process: Process) => {
  const log = LogJsonMessage.debug({ source: 'billingFeeOracle', taskId: process.task.id });
  const { blockchain, network } = process.task.params as Params;
  if (blockchain !== 'ethereum') {
    throw new Error('Invalid blockchain');
  }
  if (!isKey(contracts, network)) {
    throw new Error('Contracts not deployed to target network');
  }

  const later = dayjs().add(5, 'minute').toDate();
  const networkContainer = container.blockchain[blockchain].byNetwork(network);
  const provider = networkContainer.provider();
  const inspector = networkContainer.inspector();
  if (inspector === null) {
    return process.later(later);
  }
  const networkContracts = contracts[network] as { [name: string]: { address: string } };
  const balanceAddress = networkContracts.Balance.address;
  const balance = container.blockchain[blockchain].contract(balanceAddress, balanceAbi, provider);
  const storeAddress = networkContracts.StoreUpgradable.address;

  const bills = await container.model
    .billingBillTable()
    .where({
      blockchain,
      network,
      status: BillStatus.Pending,
    })
    .limit(1);
  log.ex({ billsCount: bills.length }).send();
  if (bills.length === 0) {
    return process.later(later);
  }

  const normalizeBills = await Promise.all(
    bills.map(async (bill) => {
      const [tx, receipt, info] = await Promise.all([
        provider.getTransaction(bill.tx),
        provider.getTransactionReceipt(bill.tx),
        balance.bills(bill.number),
      ]);

      return {
        bill,
        tx,
        receipt,
        info,
      };
    }),
  );
  const fees = normalizeBills.reduce((res: ProcessedBill[], { bill, tx, receipt, info }) => {
    if (info.status.toString() !== '0') return res;
    const gasFee =
      bill.claimant === storeAddress.toLowerCase()
        ? new BN('0')
        : new BN(receipt.gasUsed.toString()).multipliedBy(tx.gasPrice.toString());
    const protocolFee = new BN(bill.claimProtocolFee).multipliedBy(ethFeeDecimals);

    return [
      ...res,
      {
        bill,
        gasFee,
        protocolFee,
        accept: true,
      },
    ];
  }, []);
  const acceptedFees = fees.filter(({ accept }) => accept);
  const rejectedFees = fees.filter(({ accept }) => !accept);

  log
    .ex({ acceptedFees: JSON.stringify(acceptedFees), rejectedFees: JSON.stringify(rejectedFees) })
    .send();

  if (acceptedFees.length > 0) {
    await balance.connect(inspector).acceptClaims(
      acceptedFees.map(({ bill }) => bill.number),
      acceptedFees.map(({ gasFee }) => gasFee.toFixed(0)),
      acceptedFees.map(({ protocolFee }) => protocolFee.toFixed(0)),
    );
  }

  if (rejectedFees.length > 0) {
    await balance.connect(inspector).rejectClaims(rejectedFees.map(({ bill }) => bill.number));
  }

  return process.later(later);
};
