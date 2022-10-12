import { Process } from '@models/Queue/Entity';
import container from '@container';
import { TriggerType } from '@models/Automate/Entity';
import dayjs from 'dayjs';

export default async (process: Process) => {
  const queue = container.model.queueService();
  await Promise.all([
    queue.push('metricsTrackingConditionsBroker'),
    queue.push('systemGarbageCollector', {}),
    queue.push('logGarbageCollector', {}),
    queue.push('automateTriggerByTime', { type: TriggerType.EveryDay }),
    queue.push('metricsContractBroker', {}),
    queue.push('metricsWalletBroker', {}),
    queue.push('metricsProtocolLinksSocialBroker', {}),
    queue.push('metricsProtocolLinksListingBroker', {}),
    queue.push('metricsProtocolLinksPostBroker', {}),
    queue.push('metricsGarbageCollector', {}),
    queue.push('metricsContractScannerBroker', {}),
    queue.push('metricsUserBroker', {}),
    queue.push('notificationAutomateWalletsNotEnoughFundsBroker', {}),
    queue.push('metricsContractAprWeekRealBroker', {}),
    queue.push('metricsWalletBalancesWavesBroker', {}),
    queue.push('migratablePoolsBroker', {}),
    queue.push('metricsWalletProtocolsBalancesDeBankBroker', {}),
    queue.push('riskCalculationBroker'),
    queue.push('notificationsDemoCallInvitationsBroker', { days: 14 }),
    queue.push(
      'migratablePoolsBatch',
      {},
      {
        startAt: dayjs().add(15, 'minutes').toDate(),
      },
    ),
  ]);

  return process.done();
};
