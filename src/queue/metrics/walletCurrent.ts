import { Process } from '@models/Queue/Entity';
import { walletMetrics } from './utils';

export interface Params {
  contract: string;
  wallet: string;
}

export default async (process: Process) => {
  return walletMetrics(
    process.param({
      ...process.param,
      blockNumber: 'latest',
    }),
  );
};
