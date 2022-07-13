import 'source-map-support/register';
import 'module-alias/register';
import cli from 'command-line-args';
import container from './container';

const options = cli([{ name: 'period', type: String }]);

function pushPeriod() {
  const queue = container.model.queueService();
  switch (options.period) {
    case 'minute10':
      return queue.push('scheduleMinute10', {});
    case 'hourStart':
      return queue.push('scheduleHourStart', {});
    case 'dayStart':
      return queue.push('scheduleDayStart', {});
    case 'weekStart':
      return queue.push('scheduleWeekStart', {});
    case 'monthStart':
      return queue.push('scheduleMonthStart', {});
    default:
      throw new Error('Invalid period');
  }
}

pushPeriod()
  .then(() => process.exit(0))
  .catch((e) => {
    container.logger().error(e);
    process.exit(1);
  });
