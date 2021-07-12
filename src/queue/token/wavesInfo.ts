import { Process } from '@models/Queue/Entity';

export interface Params {
  token: string;
}

export default async (process: Process) => {
  // const { token: tokenId } = process.task.params as Params;

  // todo: implement

  return process.done();
};
