import 'module-alias/register';
import cla from 'command-line-args';
import * as router from '@api/cli/index';
import { isKey } from '@services/types';
import container from './container';

container.model
  .migrationService()
  .up()
  .then(async () => {
    const { command, _unknown: unknown = [] } = cla([{ name: 'command', defaultOption: true }], {
      stopAtFirstUnknown: true,
    });
    if (!isKey(router, command)) throw new Error('Undefined command');

    const handler = router[command] as (argv: string[]) => any;
    return handler(unknown);
  })
  .then(() => process.exit(0))
  .catch((e) => {
    container.logger().error(e);
    process.exit(1);
  });
