import 'source-map-support/register';
import 'module-alias/register';
import fs from 'fs';
import dayjs from 'dayjs';

if (process.argv.length < 3) {
  throw new Error('Wrong arguments');
}

const migrationName = process.argv[process.argv.length - 1];
const firstMigrationCode = fs.readFileSync(`./src/migrations/_migrationDefault.ts`);
const timestamp = dayjs().format('YYYYMMDDHHmm');

fs.writeFileSync(`./src/migrations/M${timestamp}${migrationName}.ts`, firstMigrationCode);
