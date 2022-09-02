import dayjs from 'dayjs';
import BN from 'bignumber.js';
import container from '@container';
import { Process } from '@models/Queue/Entity';
import { useEthereumFreeConsumer } from '@services/Blockchain/Consumer';
import { ethers } from 'ethers';
import contracts from '@defihelper/networks/contracts.json';
import { abi as BalanceABI } from '@defihelper/networks/abi/Balance.json';
import { isKey } from '@services/types';

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
  if (!isKey(contracts, ownerWallet.network)) {
    return new Error('Contracts not deployed to target network');
  }

  const network = container.blockchain.ethereum.byNetwork(ownerWallet.network);
  const provider = network.provider();
  const networkContracts = contracts[ownerWallet.network] as Record<
    string,
    { address: string } | undefined
  >;
  if (networkContracts.Balance === undefined) {
    return new Error('Balance contract not deployed to target network');
  }
  const balance = container.blockchain.ethereum.contract(
    networkContracts.Balance.address,
    BalanceABI,
    provider,
  );

  const freeConsumer = await useEthereumFreeConsumer(ownerWallet.network);
  if (freeConsumer === null) return new Error('Not free consumer');

  const deadline = dayjs().add(5, 'minutes').unix();
  const automate = container.blockchain.ethereum.contract(
    contract.address,
    [
      'function protocolFee() view returns (uint256)',
      'function runStopLoss(uint256 gasFee, uint256 _deadline)',
    ],
    provider,
  );

  const estimateGas = await automate.estimateGas.runStopLoss(1, deadline).then((v) => v.toString());
  const gasLimit = new BN(estimateGas).multipliedBy(1.1).toFixed(0);
  const gasPrice = await provider.getGasPrice().then((v) => v.toString());
  const gasFee = new BN(gasLimit).multipliedBy(gasPrice).toFixed(0);
  const protocolFee = await automate.protocolFee().then((v: ethers.BigNumber) => v.toString());
  const feeBalance = await balance
    .netBalanceOf(ownerWallet.address)
    .then((v: ethers.BigNumber) => v.toString());
  if (new BN(gasFee).plus(protocolFee).gt(feeBalance)) {
    return new Error('Insufficient funds to pay commission');
  }

  try {
    return automate.runStopLoss(gasFee, deadline, {
      gasLimit,
      gasPrice,
    });
  } catch (e) {
    return e instanceof Error ? e : new Error(`${e}`);
  } finally {
    await freeConsumer.unlock();
  }
  return process.done();
};
