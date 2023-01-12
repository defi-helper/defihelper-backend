import dayjs from 'dayjs';
import BN from 'bignumber.js';
import container from '@container';
import { Process } from '@models/Queue/Entity';
import { useEthereumFreeConsumer } from '@services/Blockchain/Consumer';
import { ethers } from 'ethers';
import { abi as BalanceABI } from '@defihelper/networks/abi/Balance.json';
import { ContractStopLossStatus, ContractVerificationStatus } from '@models/Automate/Entity';

interface EthersError extends Error {
  error: {
    body: string;
  };
}

function isEthersError(e: unknown): e is EthersError {
  return e instanceof Error && Object.prototype.hasOwnProperty.call(e, 'error');
}

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const stopLoss = await container.model.automateContractStopLossTable().where('id', id).first();
  if (!stopLoss) {
    throw new Error('Automate contract stop loss not found');
  }

  const contract = await container.model
    .automateContractTable()
    .where('id', stopLoss.contract)
    .first();
  if (!contract) {
    throw new Error('Automate contract not found');
  }
  if (contract.verification !== ContractVerificationStatus.Confirmed) {
    throw new Error('Automate contract not verification');
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

  const network = container.blockchain.ethereum.byNetwork(ownerWallet.network);
  const contracts = network.dfhContracts();
  if (contracts === null) {
    throw new Error('Contracts not deployed to target network');
  }
  const balanceAddress = contracts.BalanceUpgradable?.address ?? contracts.Balance?.address;
  if (balanceAddress === undefined) {
    throw new Error('Balance contract not deployed on target network');
  }
  const provider = network.provider();
  const balance = container.blockchain.ethereum.contract(balanceAddress, BalanceABI, provider);

  const freeConsumer = await useEthereumFreeConsumer(ownerWallet.network);
  if (freeConsumer === null) throw new Error('Not free consumer');

  const deadline = dayjs().add(5, 'minutes').unix();
  const automate = container.blockchain.ethereum.contract(
    contract.address,
    [
      'function protocolFee() view returns (uint256)',
      'function runStopLoss(uint256 gasFee, uint256 _deadline)',
    ],
    freeConsumer.consumer,
  );
  const automateService = container.model.automateService();

  try {
    const estimateGas = await automate.estimateGas
      .runStopLoss(1, deadline)
      .then((v) => v.toString());
    const gasLimit = new BN(estimateGas).multipliedBy(1.1).toFixed(0);
    const gasPrice = await provider.getGasPrice().then((v) => v.toString());
    const gasFee = new BN(gasLimit).multipliedBy(gasPrice).toFixed(0);
    const protocolFee = await automate.protocolFee().then((v: ethers.BigNumber) => v.toString());
    const feeBalance = await balance
      .netBalanceOf(ownerWallet.address)
      .then((v: ethers.BigNumber) => v.toString());
    if (new BN(gasFee).plus(protocolFee).gt(feeBalance)) {
      throw new Error('Insufficient funds to pay commission');
    }

    const res: { tx: ethers.ContractTransaction } = await automate.runStopLoss(gasFee, deadline, {
      gasLimit,
      gasPrice,
    });
    const { tx } = res;
    await automateService.updateStopLoss({
      ...stopLoss,
      status: ContractStopLossStatus.Sended,
      tx: tx.hash,
      rejectReason: '',
    });
    await container.model.queueService().push('automateContractStopLossTx', { id: stopLoss.id });
  } catch (e) {
    if (isEthersError(e)) {
      const {
        error: { message },
      } = JSON.parse(e.error.body);
      await automateService.updateStopLoss({
        ...stopLoss,
        rejectReason: message,
      });
      if (message === 'execution reverted: StopLoss::run: invalid output amount') {
        return process.done();
      }
    } else {
      await automateService.updateStopLoss({
        ...stopLoss,
        rejectReason: `${e}`,
      });
    }
    throw e instanceof Error ? e : new Error(`${e}`);
  } finally {
    await freeConsumer.unlock();
  }

  return process.done();
};
