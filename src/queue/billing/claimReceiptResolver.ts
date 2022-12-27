import BN from 'bignumber.js';
import container from '@container';
import { Process } from '@models/Queue/Entity';
import { abi as balanceAbi } from '@defihelper/networks/abi/Balance.json';

interface Params {
  network: string;
  txId: string;
}

export default async (process: Process) => {
  const { network, txId } = process.task.params as Params;

  const blockchainContainer = container.blockchain.ethereum;
  const networkContainer = blockchainContainer.byNetwork(network);
  const contracts = networkContainer.dfhContracts();
  if (contracts === null) {
    throw new Error('Contracts not deployed to target network');
  }
  const balanceAddress = contracts.BalanceUpgradable?.address;
  if (balanceAddress === undefined) {
    throw new Error('Balance contract not deployed on this network');
  }
  const provider = networkContainer.provider();
  const balance = blockchainContainer.contract(balanceAddress, balanceAbi, provider);
  const { decimals } = networkContainer.nativeTokenDetails;

  try {
    const receipt = await provider.getTransactionReceipt(txId);
    const eventLog = receipt.logs.find(
      ({ address }) => address.toLowerCase() === balanceAddress.toLowerCase(),
    );
    if (!eventLog) {
      return process.done();
    }

    const event = balance.interface.parseLog(eventLog);
    if (event.name !== 'Claim') {
      return process.done();
    }

    const bill = await balance.bills(event.args.bill.toString());

    await container.model
      .billingService()
      .claim(
        bill.id.toString(),
        'ethereum',
        network,
        bill.account.toLowerCase(),
        bill.claimant.toLowerCase(),
        new BN(bill.gasFee.toString()).div(`1e${decimals}`),
        new BN(bill.protocolFee.toString()).div(`1e${decimals}`),
        event.args.description,
        txId,
      );
  } catch (e) {
    if (process.task.attempt > 10) {
      throw e;
    }

    return process.info(`${e}`).laterAt(1, 'minute');
  }

  return process.done();
};
