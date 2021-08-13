import { Process } from '@models/Queue/Entity';
import { contractMetrics } from './utils';

export interface Params {
  contract: string;
  blockNumber: string;
}

export default async (process: Process) => {
  return contractMetrics(process);
};
