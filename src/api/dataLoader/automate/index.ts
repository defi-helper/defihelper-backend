import container from '@container';
import { ContractStopLoss } from '@models/Automate/Entity';
import DataLoader from 'dataloader';

export const automateContractStopLossLoader = () =>
  new DataLoader<string, ContractStopLoss | null>(async (contractsId) => {
    const map = await container.model
      .automateContractStopLossTable()
      .whereIn('contract', contractsId)
      .then((rows) => new Map(rows.map((stopLoss) => [stopLoss.contract, stopLoss])));

    return contractsId.map((id) => map.get(id) ?? null);
  });
