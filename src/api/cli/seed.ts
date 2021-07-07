import { isKey } from '@services/types';
import * as seeds from '../../seeds/index';

export default async ([seed = 'main', ...args]: string[]) => {
  if (!isKey(seeds, seed)) throw new Error(`Undefined seed "${seed}"`);

  const handler = seeds[seed] as (args: string[]) => any;
  return handler(args);
};
