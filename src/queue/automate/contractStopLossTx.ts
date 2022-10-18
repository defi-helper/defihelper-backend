import container from '@container';
import { ContractStopLossStatus } from '@models/Automate/Entity';
import { Process } from '@models/Queue/Entity';
import BN from 'bignumber.js';
import dayjs from 'dayjs';
import { ethers } from 'ethers';

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const stopLoss = await container.model.automateContractStopLossTable().where('id', id).first();
  if (!stopLoss) {
    throw new Error('Automate contract stop loss not found');
  }
  if (stopLoss.status === ContractStopLossStatus.Pending) {
    throw new Error('Transaction not sended');
  }
  if ([ContractStopLossStatus.Completed, ContractStopLossStatus.Error].includes(stopLoss.status)) {
    return process.done();
  }

  const contract = await container.model
    .automateContractTable()
    .where('id', stopLoss.contract)
    .first();
  if (!contract) {
    throw new Error('Automate contract not found');
  }

  const ownerWallet = await container.model
    .walletBlockchainTable()
    .where('id', contract.wallet)
    .first();
  if (!ownerWallet) {
    throw new Error('Wallet not found');
  }
  if (ownerWallet.blockchain !== 'ethereum') {
    throw new Error('Ethereum blockchain supported only');
  }

  const provider = container.blockchain.ethereum.byNetwork(ownerWallet.network).provider();
  const tokenOut = container.blockchain.ethereum.contract(
    stopLoss.stopLoss.path[stopLoss.stopLoss.path.length - 1],
    container.blockchain.ethereum.abi.erc20ABI,
    provider,
  );
  const tokenOutDecimals = await tokenOut.decimals().then((v: ethers.BigNumber) => v.toString());

  try {
    const receipt = await provider.waitForTransaction(stopLoss.tx, 1, 10000);
    if (receipt.status === 0) {
      return process.later(dayjs().add(10, 'seconds').toDate());
    }

    const parser = new ethers.utils.Interface(['event StopLossOrderCompleted(uint256 amountOut)']);
    const event = receipt.logs.reduce<ethers.utils.LogDescription | null>((prev, topic) => {
      if (prev !== null) return prev;
      try {
        const logDescription = parser.parseLog(topic);
        return logDescription.name === 'StopLossOrderCompleted' ? logDescription : null;
      } catch (e) {
        return null;
      }
    }, null);
    if (!event) {
      await container.model.automateService().updateStopLoss({
        ...stopLoss,
        status: ContractStopLossStatus.Error,
        rejectReason: 'Transaction  not include target event',
      });
      return process.done();
    }
    const amountOut = new BN(event.args.amountOut.toString()).div(`1e${tokenOutDecimals}`);

    await container.model.automateService().updateStopLoss({
      ...stopLoss,
      status: ContractStopLossStatus.Completed,
      amountOut: amountOut.toString(10),
    });
  } catch (e) {
    if (e instanceof Error) {
      if (e.message.includes('timeout exceeded')) {
        return process.later(dayjs().add(10, 'seconds').toDate());
      }
      if (e.message.includes('no matching event')) {
        await container.model.automateService().updateStopLoss({
          ...stopLoss,
          status: ContractStopLossStatus.Error,
          rejectReason: 'Transaction  not include target event',
        });
        return process.done();
      }
    }
    throw e;
  }

  return process.done();
};
