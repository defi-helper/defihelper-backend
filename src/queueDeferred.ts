import 'source-map-support/register';
import 'module-alias/register';
import cli from 'command-line-args';
import container from './container';

const options = cli([{ name: 'limit', alias: 'l', type: Number, defaultValue: 1000 }]);

container.rabbitmq().on('disconnected', () => {
  throw new Error('Rabbit disconnected');
});
container.model
  .queueService()
  .deferred(options.limit)
  .then(() => {
    container.logger().info(`Publish deferred "${options.limit}" queue tasks`);
    process.exit(0);
  });
