import container from '@container';
import {
  actionTableName,
  ContractRebalance,
  contractRebalanceTableName,
  ContractRebalanceTx,
  ContractRebalanceTxStatus,
  contractRebalanceTxTableName,
  ContractStopLoss,
  Trigger,
  triggerTableName,
} from '@models/Automate/Entity';
import DataLoader from 'dataloader';

export const automateContractTriggerLoader = () =>
  new DataLoader<string, Trigger>(async (contractsId) => {
    const map = await container.model
      .automateTriggerTable()
      .distinct(`${triggerTableName}.*`)
      .column({ contract: container.database().raw(`${actionTableName}.params->>'id'`) })
      .innerJoin(actionTableName, `${triggerTableName}.id`, `${actionTableName}.trigger`)
      .where(`${actionTableName}.type`, 'ethereumAutomateRun')
      .whereRaw(
        `${actionTableName}.params->>'id' IN (${contractsId.map((id) => `'${id}'`).join(', ')})`,
      )
      .then((rows) => new Map(rows.map((trigger) => [trigger.contract, trigger])));

    return contractsId.map((id) => map.get(id) ?? null);
  });

export const automateContractStopLossLoader = () =>
  new DataLoader<string, ContractStopLoss | null>(async (contractsId) => {
    const map = await container.model
      .automateContractStopLossTable()
      .whereIn('contract', contractsId)
      .then((rows) => new Map(rows.map((stopLoss) => [stopLoss.contract, stopLoss])));

    return contractsId.map((id) => map.get(id) ?? null);
  });

export const automateContractRebalanceLoader = () =>
  new DataLoader<string, ContractRebalance | null>(async (contractsId) => {
    const map = await container.model
      .automateContractRebalanceTable()
      .whereIn('contract', contractsId)
      .then((rows) => new Map(rows.map((rebalance) => [rebalance.contract, rebalance])));

    return contractsId.map((id) => map.get(id) ?? null);
  });

export const automateInvestHistoryLoader = () =>
  new DataLoader<string, { amount: string; amountUSD: string }>(async (contractsId) => {
    const map = await container.model
      .automateInvestHistoryTable()
      .column('contract')
      .sum({ amount: 'amount' })
      .sum({ amountUSD: 'amountUSD' })
      .whereIn('contract', contractsId)
      .where('confirmed', true)
      .where('refunded', false)
      .groupBy('contract')
      .then(
        (rows) =>
          new Map(
            rows.map(({ contract, amount, amountUSD }) => [
              contract,
              { amount: amount ?? '0', amountUSD: amountUSD ?? '0' },
            ]),
          ),
      );

    return contractsId.map((id) => map.get(id) ?? { amount: '0', amountUSD: '0' });
  });

export const automateRebalanceLoader = () =>
  new DataLoader<string, ContractRebalance | undefined>(async (contractsId) => {
    const map = await container.model
      .automateContractRebalanceTable()
      .whereIn('contract', contractsId)
      .then((rows) => new Map(rows.map((rebalance) => [rebalance.contract, rebalance])));

    return contractsId.map((id) => map.get(id));
  });

export const automateLastRebalanceTxLoader = () =>
  new DataLoader<string, ContractRebalanceTx | undefined>(async (contractsId) => {
    const map = await container.model
      .automateContractRebalanceTxTable()
      .distinctOn(`${contractRebalanceTableName}.contract`)
      .column(`${contractRebalanceTxTableName}.*`)
      .column<Array<ContractRebalanceTx & { contract: string }>>(
        `${contractRebalanceTableName}.contract`,
      )
      .innerJoin(
        contractRebalanceTableName,
        `${contractRebalanceTableName}.id`,
        `${contractRebalanceTxTableName}.rebalance`,
      )
      .whereIn(`${contractRebalanceTxTableName}.contract`, contractsId)
      .where(`${contractRebalanceTxTableName}.status`, ContractRebalanceTxStatus.Completed)
      .groupBy(`${contractRebalanceTxTableName}.contract`)
      .orderBy(`${contractRebalanceTxTableName}.updatedAt`)
      .limit(1)
      .then((rows) => new Map(rows.map((tx) => [tx.contract, tx])));

    return contractsId.map((id) => map.get(id));
  });
