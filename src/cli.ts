import 'module-alias/register';
import container from './container';
import cla from 'command-line-args';
import * as router from '@api/cli/index';
import { isKey } from '@services/types';

container.model
  .migrationService()
  .up()
  .then(async () => {
    const { command, _unknown = [] } = cla([{ name: 'command', defaultOption: true }], {
      stopAtFirstUnknown: true,
    });
    if (!isKey(router, command)) throw new Error('Undefined command');

    const handler = router[command] as (argv: string[]) => any;
    return handler(_unknown);
  })
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
