import 'source-map-support/register';
import 'module-alias/register';
import cli from 'command-line-args';
import container from '@container';
import { TriggerType } from '@models/Automate/Entity';

container.model
  .migrationService()
  .up()
  .then(async () => {
    const options = cli([
      { name: 'topic', alias: 't', type: String, defaultValue: 'scanner.events.*' },
      { name: 'queue', alias: 'q', type: String, defaultValue: 'dfh_scanner_events' },
    ]);

    const database = container.database();
    const queue = container.model.queueService();
    const rabbit = container.rabbitmq();
    rabbit.on('disconnected', () => {
      throw new Error('Rabbit disconnected');
    });
    rabbit.createQueue(
      options.queue,
      { durable: false, autoDelete: true },
      async ({ content }, ack) => {
        const { contract, listener } = JSON.parse(content.toString());
        ack();

        const triggers = await container.model
          .automateTriggerTable()
          .where('type', TriggerType.ContractEvent)
          .where(database.raw(`params->>'network' = ?`, contract.network))
          .where(database.raw(`params->>'address' = ?`, contract.address.toLowerCase()))
          .where(database.raw(`params->>'event' = ?`, listener.name));
        triggers.map(({ id }) => queue.push('automateTriggerRun', { id }));
      },
    );
    rabbit.bindToTopic(options.queue, options.topic);
  })
  .catch((e) => {
    container.logger().error(e);
    process.exit(1);
  });
