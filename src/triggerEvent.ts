import 'source-map-support/register';
import 'module-alias/register';
import cli from 'command-line-args';
import process from 'process';
import container from '@container';
import { TriggerType } from '@models/Automate/Entity';

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
let isConsume = false;
let isStoped = false;
rabbit.createQueue(
  options.queue,
  { durable: false, autoDelete: true },
  async ({ content }, ack) => {
    if (isStoped) return;
    isConsume = true;
    const { contract, listener } = JSON.parse(content.toString());

    const triggers = await container.model
      .automateTriggerTable()
      .where('type', TriggerType.ContractEvent)
      .where(database.raw(`params->>'network' = ?`, contract.network))
      .where(database.raw(`LOWER(params->>'address') = ?`, contract.address.toLowerCase()))
      .where(database.raw(`params->>'event' = ?`, listener.name));
    triggers.map(({ id }) => queue.push('automateTriggerRun', { id }, { topic: 'trigger' }));
    ack();
    if (isStoped) setTimeout(() => rabbit.close(), 500); // for ack work
    isConsume = false;
  },
);
rabbit.bindToTopic(options.queue, options.topic);

process.on('SIGTERM', () => {
  isStoped = true;
  if (!isConsume) rabbit.close();
});
