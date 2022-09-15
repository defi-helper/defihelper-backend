import container from '@container';
import { Process } from '@models/Queue/Entity';

export interface Params {
  name: string;
  user: string;
  payload?: {
    [key: string]: any;
  };
}

export default async (process: Process) => {
  const { name, user, payload } = process.task.params as Params;

  await container.amplitude().log(name, user, payload ?? {});
  return process.done();
};
