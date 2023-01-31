import container from '@container';
import { ActionParams, Condition, ContractVerificationStatus } from '@models/Automate/Entity';
import { EthereumAutomateAdapter, EthereumProtocolAdapter } from '@services/Blockchain/Adapter';
import axios from 'axios';
import BN from 'bignumber.js';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import * as uuid from 'uuid';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';

export interface Params {
  id: string;
}

export function paramsVerify(params: any): params is Params {
  const { id } = params;
  if (typeof id !== 'string' || !uuid.validate(id)) {
    throw new Error('Invalid action identifier');
  }

  return true;
}

export default async function (this: Condition, params: Params) {
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
    contract.contract === null ||
    contract.archivedAt !== null
  ) {
    return false;
  }

  const wallet = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where(`${walletTableName}.id`, contract.wallet)
    .first();
  if (!wallet) throw new Error('Wallet not found');

  const protocol = await container.model.protocolTable().where('id', contract.protocol).first();
  if (!protocol) throw new Error('Protocol not found');

  const targetContract = await container.model
    .contractTable()
    .innerJoin(
      contractBlockchainTableName,
      `${contractBlockchainTableName}.id`,
      `${contractTableName}.id`,
    )
    .where(`${contractTableName}.id`, contract.contract)
    .first();
  if (!targetContract) throw new Error('Target contract not found');

  const condition = await container.model.automateConditionTable().where('id', this.id).first();
  if (!condition) throw new Error('Condition not found');
  // Disable trigger if target contract deprecated
  if (targetContract.deprecated) {
    const trigger = await container.model
      .automateTriggerTable()
      .where('id', condition.trigger)
      .first();
    if (!trigger) return false;

    await container.model.automateService().updateTrigger({
      ...trigger,
      active: false,
    });
    return false;
  }
  if (protocol.hidden || targetContract.hidden) {
    return false;
  }

  const network = container.blockchain.ethereum.byNetwork(wallet.network);
  const provider = network.provider();
  const gasPriceUSD = await network.nativeTokenPrice();
  const signer = network.consumers()[0];
  if (!signer) {
    throw new Error('Consumer not found');
  }

  const adapters = await container.blockchainAdapter.loadAdapter<EthereumProtocolAdapter>(
    protocol.adapter,
  );
  if (!adapters.automates) {
    throw new Error('Automates adapters not found');
  }

  const targetContractAdapterFactory = adapters[targetContract.adapter];
  if (typeof targetContractAdapterFactory !== 'function') {
    throw new Error('Target contract adapter not found');
  }

  const { metrics: contractMetrics, wallet: walletTargetContractAdapter } =
    await targetContractAdapterFactory(provider, targetContract.address, {
      blockNumber: 'latest',
    });
  if (typeof walletTargetContractAdapter !== 'function') {
    throw new Error('Target contract adapter for wallet not found');
  }
  if (typeof contractMetrics !== 'object' || !contractMetrics.aprDay) {
    throw new Error('Target contract metrics not found');
  }
  const { metrics: walletMetrics } = await walletTargetContractAdapter(contract.address);
  if (typeof walletMetrics !== 'object' || !walletMetrics.stakingUSD || !walletMetrics.earnedUSD) {
    throw new Error('Target contract metrics not found');
  }

  const automateAdapterFactory = adapters.automates[contract.adapter] as EthereumAutomateAdapter;
  if (typeof automateAdapterFactory !== 'function') throw new Error('Automate adapter not found');
  const automateAdapter = await automateAdapterFactory(signer, contract.address);
  const automateRunParams = await automateAdapter.run.methods.runParams();
  if (automateRunParams instanceof Error) {
    if (automateRunParams.message === 'No earned') {
      return false;
    }
    throw automateRunParams;
  }
  const {
    calldata: [gasFee],
  } = automateRunParams;

  const { data: optimalRes } = await axios.get(`${container.parent.restakeOptimal.host}/optimal`, {
    params: {
      balance: new BN(walletMetrics.stakingUSD).toFixed(4),
      earned: new BN(walletMetrics.earnedUSD).toFixed(4),
      apd: contractMetrics.aprDay,
      fee: new BN(gasFee).div('1e18').multipliedBy(gasPriceUSD).plus(1).toFixed(4),
      minInterval: 3600,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return new BN(optimalRes.v).lte(0);
}
