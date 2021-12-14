import container from '@container';
import { ActionParams, ContractVerificationStatus } from '@models/Automate/Entity';
import { EthereumAutomateAdapter } from '@services/Blockchain/Adapter';
import axios from 'axios';
import BN from 'bignumber.js';

interface Params {
  id: string;
}

export default async (params: Params) => {
  const action = await container.model
    .automateActionTable()
    .where({
      id: params.id,
      type: 'ethereumAutomateRun',
    })
    .first();
  if (!action) throw new Error('Action not found');
  const { id: contractId } = action.params as ActionParams<'ethereumAutomateRun'>;

  const contract = await container.model.automateContractTable().where('id', contractId).first();
  if (!contract) throw new Error('Contract not found');
  if (
    contract.verification !== ContractVerificationStatus.Confirmed ||
    contract.contract === null
  ) {
    return false;
  }

  const wallet = await container.model.walletTable().where('id', contract.wallet).first();
  if (!wallet) throw new Error('Wallet not found');

  const protocol = await container.model.protocolTable().where('id', contract.protocol).first();
  if (!protocol) throw new Error('Protocol not found');

  const targetContract = await container.model
    .contractTable()
    .where('id', contract.contract)
    .first();
  if (!targetContract) throw new Error('Target contract not found');

  const network = container.blockchain.ethereum.byNetwork(wallet.network);
  const provider = network.provider();
  const gasPriceUSD = await network.nativeTokenPrice();
  const signer = network.consumers()[0];
  if (!signer) {
    throw new Error('Consumer not found');
  }

  const adapters = await container.blockchainAdapter.loadAdapter(protocol.adapter);
  if (!adapters.automates || typeof adapters.automates !== 'object') {
    throw new Error('Automates adapters not found');
  }

  const targetContractAdapterFactory = adapters[targetContract.adapter];
  if (typeof targetContractAdapterFactory !== 'function') {
    throw new Error('Target contract adapter not found');
  }

  const { metrics: targetContractMetrics, wallet: walletTargetContractAdapter } =
    await targetContractAdapterFactory(provider, targetContract.address, {
      blockNumber: 'latest',
    });
  if (typeof walletTargetContractAdapter !== 'function') {
    throw new Error('Target contract adapter for wallet not found');
  }
  if (typeof targetContractMetrics !== 'object' || !targetContractMetrics.aprDay) {
    throw new Error('Target contract metrics not found');
  }
  const { aprDay } = targetContractMetrics;

  const { metrics: targetContractWalletMetrics } = await walletTargetContractAdapter(
    contract.address,
  );
  if (
    typeof targetContractWalletMetrics !== 'object' ||
    !targetContractWalletMetrics.stakingUSD ||
    !targetContractWalletMetrics.earnedUSD
  ) {
    throw new Error('Target contract metrics not found');
  }
  const { stakingUSD, earnedUSD } = targetContractWalletMetrics;

  const automateAdapterFactory = adapters.automates[contract.adapter] as EthereumAutomateAdapter;
  if (typeof automateAdapterFactory !== 'function') throw new Error('Automate adapter not found');
  const automateAdapter = await automateAdapterFactory(signer, contract.address);
  const automateRunParams = await automateAdapter.runParams();
  if (automateRunParams instanceof Error) throw automateRunParams;
  const {
    calldata: [gasFee],
  } = automateRunParams;
  const fee = new BN(gasFee).div(new BN(10).pow(18)).multipliedBy(gasPriceUSD).toFixed(4);

  const { data: optimalRes } = await axios.get(`${container.parent.restakeOptimal.host}/optimal`, {
    params: {
      balance: stakingUSD,
      earned: earnedUSD,
      apd: aprDay,
      fee,
      minInterval: 3600,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return new BN(optimalRes.v).lte(0);
};
