import 'source-map-support/register';
import 'module-alias/register';
import cli from 'command-line-args';
import container from './container';

container.model
  .migrationService()
  .up()
  .then(async () => {
    const options = cli([{ name: 'limit', alias: 'l', type: Number, defaultValue: 1000 }]);

    container.rabbitmq().on('disconnected', () => {
      throw new Error('Rabbit disconnected');
    });
    await container.model.queueService().deferred(options.limit);

    container.logger().info(`Publish deferred "${options.limit}" queue tasks`);

    process.exit(0);
  })
  .catch((e) => {
    container.logger().error(e);
    process.exit(1);
  });
