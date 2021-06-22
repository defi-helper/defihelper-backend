import { Process } from '@models/Queue/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  console.log(process.task.params);
  return process.done();
};
