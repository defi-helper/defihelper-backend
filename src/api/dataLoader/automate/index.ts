import container from '@container';
import {
  actionTableName,
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
