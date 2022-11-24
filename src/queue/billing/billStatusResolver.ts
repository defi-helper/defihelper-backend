import container from '@container';
import { Process } from '@models/Queue/Entity';
import BN from 'bignumber.js';
import { abi as balanceAbi } from '@defihelper/networks/abi/Balance.json';
import { LogJsonMessage } from '@services/Log';

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;
  const log = LogJsonMessage.debug({ source: 'billingBillStatusResolver', billId: id });

  const bill = await container.model.billingBillTable().where('id', id).first();
  if (!bill) {
    throw new Error(`Bill "${id}" not found`);
  }
  if (bill.blockchain !== 'ethereum') {
    throw new Error('Invalid blockchain');
  }

  const blockchainContainer = container.blockchain[bill.blockchain];
  const networkContainer = blockchainContainer.byNetwork(bill.network);
  const contracts = networkContainer.dfhContracts();
  if (contracts === null) {
    throw new Error('Contracts not deployed to target network');
  }
  const balanceAddress = contracts.BalanceUpgradable?.address ?? contracts.Balance?.address;
  if (balanceAddress === undefined) {
    throw new Error('Balance contract not deployed on this network');
  }
  const provider = networkContainer.provider();
  const balance = blockchainContainer.contract(balanceAddress, balanceAbi, provider);

  const billingService = container.model.billingService();
  try {
    const billState = await balance.bills(bill.number);
    log
      .ex({
        billAccount: billState.account,
        billStatus: billState.status.toString(),
        billGasFee: billState.gasFee.toString(),
        billProtocolFee: billState.protocolFee.toString(),
      })
      .send();
    if (billState.account === '0x0000000000000000000000000000000000000000') {
      throw new Error('Order not registered');
    }

    const { status, gasFee, protocolFee } = billState;
    const { decimals } = networkContainer.nativeTokenDetails;
    switch (status.toString()) {
      case '1':
        await billingService.acceptBill(
          bill,
          new BN(gasFee.toString()).div(`1e${decimals}`),
          new BN(protocolFee.toString()).div(`1e${decimals}`),
        );
        return process.done();
      case '2':
        await billingService.rejectBill(bill);
        return process.done();
      default:
        return process.laterAt(1, 'minutes');
    }
  } catch (e) {
    return process.laterAt(1, 'minutes').info(`${e}`);
  }
};
