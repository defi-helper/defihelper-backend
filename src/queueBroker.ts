import 'source-map-support/register';
import 'module-alias/register';
import container from './container';

async function handle() {
  const queue = container.model.queueService();

  const [task] = await queue.getCandidates(1);
  if (!task) return false;

  const isLocked = await queue.lock(task);
  if (!isLocked) return false;

  await queue.handle(task);
  return true;
}

function wait(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

const broker = (): any => handle().then((r) => wait(r ? 0 : 1000).then(() => broker()));

container.model
  .migrationService()
  .up()
  .then(async () => {
    broker();
    container.logger().info(`Handle queue tasks`);
  })
  .catch((e) => {
    container.logger().error(e);
    process.exit(1);
  });
