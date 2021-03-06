import 'source-map-support/register';
import 'module-alias/register';
import cla from 'command-line-args';
import * as router from '@api/cli/index';
import { isKey } from '@services/types';

const { command, _unknown: unknown = [] } = cla([{ name: 'command', defaultOption: true }], {
  stopAtFirstUnknown: true,
});
if (!isKey(router, command)) throw new Error('Undefined command');

const handler = router[command] as (argv: string[]) => any;
Promise.resolve(handler(unknown)).then(() => process.exit(0));
