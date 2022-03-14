import 'source-map-support/register';
import 'pretty-error/start';
import 'module-alias/register';
import cli from 'command-line-args';
import container from './container';

container.model
  .migrationService()
  .up()
  .then(async () => {
    const options = cli([{ name: 'period', type: String }]);

    const queue = container.model.queueService();
    switch (options.period) {
      case 'minute10':
        await queue.push('scheduleMinute10', {});
        break;
      case 'hourStart':
        await queue.push('scheduleHourStart', {});
        break;
      case 'dayStart':
        await queue.push('scheduleDayStart', {});
        break;
      case 'weekStart':
        await queue.push('scheduleWeekStart', {});
        break;
      case 'monthStart':
        await queue.push('scheduleMonthStart', {});
        break;
      default:
        throw new Error('Invalid period');
    }

    process.exit(0);
  })
  .catch((e) => {
    container.logger().error(e);
    process.exit(1);
  });
