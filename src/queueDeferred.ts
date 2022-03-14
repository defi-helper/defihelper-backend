import 'source-map-support/register';
import 'module-alias/register';
import cli from 'command-line-args';
import container from './container';

container.model
  .migrationService()
  .up()
  .then(async () => {
    const options = cli([
      { name: 'interval', alias: 'i', type: Number, defaultValue: 10 },
      { name: 'limit', alias: 'l', type: Number, defaultValue: 10 },
    ]);

    container.rabbitmq().on('disconnected', () => {
      throw new Error('Rabbit disconnected');
    });
    setInterval(() => {
      container.model.queueService().deferred(options.limit);
    }, options.interval * 1000);

    container
      .logger()
      .info(
        `Publish deferred "${options.limit}" queue tasks with interval "${options.interval}" seconds`,
      );
  })
  .catch((e) => {
    container.logger().error(e);
    process.exit(1);
  });
