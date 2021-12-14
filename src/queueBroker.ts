import 'module-alias/register';
import cli from 'command-line-args';
import container from './container';

container.model
  .migrationService()
  .up()
  .then(async () => {
    const options = cli([
      { name: 'include', type: String, multiple: true, defaultValue: [] },
      { name: 'exclude', type: String, multiple: true, defaultValue: [] },
      { name: 'interval', type: Number, defaultValue: 1000 },
    ]);
    if (Number.isNaN(options.interval)) throw new Error(`Invalid interval`);

    container.model
      .queueService()
      .createBroker({
        interval: options.interval,
        handler: {
          include: options.include,
          exclude: options.exclude,
        },
      })
      .start();
    container.logger().info(`Handle tasks with interval ${options.interval} ms`);
  })
  .catch((e) => {
    container.logger().error(e);
    process.exit(1);
  });
