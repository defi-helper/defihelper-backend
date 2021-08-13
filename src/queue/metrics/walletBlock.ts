import { Process } from '@models/Queue/Entity';
import { walletMetrics } from './utils';

export interface Params {
  contract: string;
  blockNumber: string;
}

export default async (process: Process) => {
  return walletMetrics(process);
};
