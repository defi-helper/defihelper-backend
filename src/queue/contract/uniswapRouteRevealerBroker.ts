import { Process } from '@models/Queue/Entity';
import container from '@container';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const uniswapRoutableTokens = await container.model.tokenTable().where('priceFeedNeeded', true);

  

  return process.done();
};
