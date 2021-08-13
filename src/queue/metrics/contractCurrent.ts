import { Process } from '@models/Queue/Entity';
import { contractMetrics } from './utils';

export interface Params {
  contract: string;
}

export default async (process: Process) => {
  return contractMetrics(
    process.param({
      ...process.param,
      blockNumber: 'latest',
    }),
  );
};
