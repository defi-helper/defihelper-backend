import 'source-map-support/register';
import 'module-alias/register';
import cli from 'command-line-args';
import process from 'process';
import container from '@container';
import { useStopableConsumer } from '@services/Rabbitmq';
import { OrderStatus } from '@models/SmartTrade/Entity';

const options = cli([
  { name: 'topic', alias: 't', type: String, defaultValue: 'scanner.events.*' },
  { name: 'queue', alias: 'q', type: String, defaultValue: 'dfh_smartTrade_events' },
]);

const logger = container.logger();
const rabbit = container.rabbitmq();
const onRabbitDisconnected = () => {
  throw new Error('Rabbit disconnected');
};
rabbit.on('disconnected', onRabbitDisconnected);
const stopableConsumer = useStopableConsumer(() => {
  rabbit.off('disconnected', onRabbitDisconnected);
  rabbit.close();
});
rabbit.createQueue(
  options.queue,
  { durable: false, autoDelete: true },
  stopableConsumer.consume(async ({ content }, ack) => {
    const { listener } = JSON.parse(content.toString());

    const smartTradeService = container.model.smartTradeService();
    const orders = await container.model
      .smartTradeOrderTable()
      .where('confirmed', true)
      .where('status', OrderStatus.Pending)
      .where('watcherListenerId', listener.id);
    orders.forEach((order) => smartTradeService.handle(order).catch((e) => logger.error(e)));
    ack();
  }),
);
rabbit.bindToTopic(options.queue, options.topic);
process.on('SIGINT', () => {
  stopableConsumer.stop();
  process.exit(0);
});
process.on('SIGTERM', () => stopableConsumer.stop());
