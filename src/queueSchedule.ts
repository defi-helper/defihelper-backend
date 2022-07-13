import 'source-map-support/register';
import 'module-alias/register';
import cli from 'command-line-args';
import container from './container';

const options = cli([{ name: 'period', type: String }]);

const queue = container.model.queueService();
switch (options.period) {
  case 'minute10':
    queue.push('scheduleMinute10', {});
    break;
  case 'hourStart':
    queue.push('scheduleHourStart', {});
    break;
  case 'dayStart':
    queue.push('scheduleDayStart', {});
    break;
  case 'weekStart':
    queue.push('scheduleWeekStart', {});
    break;
  case 'monthStart':
    queue.push('scheduleMonthStart', {});
    break;
  default:
    throw new Error('Invalid period');
}
