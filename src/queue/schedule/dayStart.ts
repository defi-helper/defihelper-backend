import { Process } from '@models/Queue/Entity';
import container from "@container";

export default async (process: Process) => {
  const queue = container.model.queueService();
  await Promise.all([
    queue.push('sushiFarmPoolScanner', {}),
    queue.push('pancakeFarmPoolScanner', {}),
  ]);

  return process.done();
};
