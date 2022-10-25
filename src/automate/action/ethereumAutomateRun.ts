import container from '@container';
import {
  Action,
  Contract,
  contractTableName,
  ContractVerificationStatus,
  EthereumAutomateTransaction,
  transactionTableName,
} from '@models/Automate/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import { EthereumProtocolAdapter } from '@services/Blockchain/Adapter';
import { ethers, Wallet } from 'ethers';
import * as uuid from 'uuid';
import { BigNumber as BN } from 'bignumber.js';
import { abi as balanceAbi } from '@defihelper/networks/abi/Balance.json';
import { Protocol } from '@models/Protocol/Entity';

export interface Params {
  id: string;
}

export function paramsVerify(params: any): params is Params {
  const { id } = params;
  if (typeof id !== 'string' || !uuid.validate(id)) {
    throw new Error('Invalid automate contract identifier');
  }

  return true;
}

export async function getEarnedAmount(
  provider: ethers.providers.JsonRpcProvider,
  protocol: Protocol,
  contract: Contract,
  walletAddress: string,
) {
  const protocolAdapter = await container.blockchainAdapter.loadAdapter(protocol.adapter);
  const contractAdapterFactory = protocolAdapter[contract.adapter];
  if (typeof contractAdapterFactory !== 'function') throw new Error('Contract adapter not found');

  const contractAdapterReader = await contractAdapterFactory(provider, contract.address, {
    blockNumber: 'latest',
  });

  if (typeof contractAdapterReader.wallet !== 'function') {
    throw new Error('Contract adapter wallet() interface not found');
  }

  const walletMetrics = await contractAdapterReader.wallet(walletAddress);
  return new BN(walletMetrics.metrics?.earnedUSD ?? '0');
}

export default async function (this: Action, params: Params) {
  const contract = await container.model.automateContractTable().where('id', params.id).first();
  if (!contract) throw new Error('Contract not found');
  if (contract.verification !== ContractVerificationStatus.Confirmed) {
    throw new Error('Contract not verified');
  }
  if (contract.archivedAt !== null) {
    throw new Error('Contract on archive');
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
  if (wallet.blockchain !== 'ethereum') throw new Error('Invalid blockchain');

  const protocol = await container.model.protocolTable().where('id', contract.protocol).first();
  if (!protocol) throw new Error('Protocol not found');

  const { automates } = await container.blockchainAdapter.loadAdapter<EthereumProtocolAdapter>(
    protocol.adapter,
  );
  if (!automates) throw new Error('Automates adapters not found');
  const adapterFactory = automates[contract.adapter];
  if (adapterFactory === undefined) throw new Error('Automate adapter not found');

  const network = container.blockchain.ethereum.byNetwork(wallet.network);
  const contracts = network.dfhContracts();
  if (contracts === null) {
    throw new Error('Contracts not deployed to target network');
  }
  const provider = network.provider();
  const consumers = network.consumers();
  const balanceAddress = contracts.BalanceUpgradable?.address ?? contracts.Balance?.address;
  if (balanceAddress === undefined) {
    throw new Error(`Balance contract not deployed on "${wallet.network}" network`);
  }
  const balance = container.blockchain.ethereum.contract(balanceAddress, balanceAbi, provider);
  const walletBalance: BN = await balance
    .netBalanceOf(wallet.address)
    .then((v: ethers.BigNumber) =>
      new BN(v.toString()).div(`1e${network.nativeTokenDetails.decimals}`),
    );
  const nativeTokenUSD = await network.nativeTokenPrice();
  if (walletBalance.multipliedBy(nativeTokenUSD).lt(1)) {
    throw new Error(`Insufficient funds "${walletBalance.toString(10)}" to start automation`);
  }

  const busyConsumers = await container.model
    .automateTransactionTable()
    .distinct(`${transactionTableName}.consumer`)
    .innerJoin(contractTableName, `${transactionTableName}.contract`, `${contractTableName}.id`)
    .innerJoin(walletTableName, `${contractTableName}.wallet`, `${walletTableName}.id`)
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where(function () {
      this.andWhere(`${walletBlockchainTableName}.blockchain`, wallet.blockchain)
        .andWhere(`${walletBlockchainTableName}.network`, wallet.network)
        .andWhere(`${transactionTableName}.confirmed`, false)
        .whereIn(
          `${transactionTableName}.consumer`,
          consumers.map(({ address }) => address),
        );
    })
    .then((rows) => rows.map(({ consumer }) => consumer));
  const freeConsumers = consumers.filter(({ address }) => !busyConsumers.includes(address));
  if (freeConsumers.length === 0) throw new Error('Not free consumer');

  const consumer = await freeConsumers.reduce<Promise<Wallet | null>>(async (prev, current) => {
    const result = await prev;
    if (result !== null) return result;

    return container
      .semafor()
      .lock(
        `defihelper:automate:consumer:${wallet.blockchain}:${wallet.network}:${current.address}`,
      )
      .then(() => current)
      .catch(() => null);
  }, Promise.resolve(null));
  if (consumer === null) throw new Error('Not free consumer');

  const earnedUsd = await getEarnedAmount(provider, protocol, contract, wallet.address).catch(
    () => new BN(0),
  );
  const { run: adapter } = await adapterFactory(consumer, contract.address);
  try {
    const res = await adapter.methods.run();
    if (res instanceof Error) throw res;

    const { tx } = res;
    await Promise.all([
      container.model
        .automateService()
        .createTransaction<EthereumAutomateTransaction>(contract, consumer.address, {
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          nonce: tx.nonce,
        }),
      container.amplitude().log('automation_fee_charged_successful', wallet.user, {
        hash: tx.hash,
      }),
      !earnedUsd.isZero()
        ? container.model.queueService().push('automateNotifyExecutedRestake', {
            contract: contract.id,
            amount: earnedUsd.toFixed(2),
          })
        : null,
    ]);
  } catch (e) {
    await container
      .semafor()
      .unlock(
        `defihelper:automate:consumer:${wallet.blockchain}:${wallet.network}:${consumer.address}`,
      );
    container.amplitude().log('automation_fee_charged_unsuccessfull', wallet.user, {
      network: wallet.network,
      address: consumer.address,
    });
    throw e;
  }
}
