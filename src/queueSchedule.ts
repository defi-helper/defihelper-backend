import 'module-alias/register';
import container from './container';
import cli from 'command-line-args';

container.model
  .migrationService()
  .up()
  .then(async () => {
    const options = cli([{ name: 'period', type: String }]);

    const queue = container.model.queueService();
    switch (options.period) {
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
    }

    process.exit(0);
  })
  .catch((e) => {
    container.logger().error(e);
    process.exit(1);
  });
