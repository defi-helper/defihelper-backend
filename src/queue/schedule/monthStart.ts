import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  return process.done();
};
