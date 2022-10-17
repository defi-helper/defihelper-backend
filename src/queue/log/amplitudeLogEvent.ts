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

  const res = await container.amplitude().log(name, user, payload ?? {});
  if (res.statusCode !== 200) {
    throw new Error(`Amplitude did not accepted the request: ${res.status}`);
  }

  return process.done();
};
