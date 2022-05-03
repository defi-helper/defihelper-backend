import { Process } from '@models/Queue/Entity';
import container from '@container';
import { TriggerType } from '@models/Automate/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();
  await Promise.all([
    queue.push('systemGarbageCollector', {}),
    queue.push('automateTriggerByTime', { type: TriggerType.EveryDay }),
    queue.push('metricsProtocolLinksSocialBroker', {}),
    queue.push('metricsProtocolLinksListingBroker', {}),
    queue.push('metricsProtocolLinksPostBroker', {}),
    queue.push('metricsContractScannerBroker', {}),
    queue.push('metricsWalletBalancesBroker', {}),
    queue.push('notificationAutomateWalletsNotEnoughFundsBroker', {}),
    queue.push('treasuryStatsCache', {}),
    queue.push('metricsContractAprWeekRealBroker', {}),
    queue.push('metricsUserBalancesBroker', {}),
  ]);

  return process.done();
};
