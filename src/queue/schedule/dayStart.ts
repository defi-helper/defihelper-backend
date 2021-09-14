import { Process } from '@models/Queue/Entity';
import container from '@container';
import { TriggerType } from '@models/Automate/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();
  await Promise.all([
    queue.push('masterChiefFarmPoolScanner', {
      masterChefAddress: '0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd',
      protocolName: 'SushiSwap',
      protocolDescription: 'SushiSwap Farm',
      adapterName: 'sushiswap',
      farmingAdapterName: 'masterChefV1',
      network: '1',
    }),
    queue.push('masterChiefFarmPoolScanner', {
      masterChefAddress: '0x73feaa1ee314f8c655e354234017be2193c9e24e',
      protocolName: 'PancakeSwap',
      protocolDescription: 'PancakeSwap Farm',
      adapterName: 'pancakeswap',
      farmingAdapterName: 'masterChef',
      network: '56',
    }),
    queue.push('masterChiefFarmPoolScanner', {
      masterChefAddress: '0xc48fe252aa631017df253578b1405ea399728a50',
      protocolName: 'MDEX',
      protocolDescription: 'MDEX Farm',
      adapterName: 'mdex',
      farmingAdapterName: 'masterChef',
      network: '56',
    }),
    queue.push('pancakeStakingPoolScanner', {}),
    queue.push('quickSwapPolygonStakingPoolScanner', {}),
    queue.push('swopfiLPFarmingPoolScanner', {}),
    queue.push('automateTriggerByTime', { type: TriggerType.EveryDay }),
  ]);

  return process.done();
};
