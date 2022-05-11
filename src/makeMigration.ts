import 'source-map-support/register';
import 'module-alias/register';
import fs from 'fs';
import dayjs from 'dayjs';

const firstMigration = fs.readdirSync('./src/migrations/')[0];
if (!firstMigration) {
  throw new Error('Migration must be found');
}

const firstMigrationCode = fs.readFileSync(`./src/migrations/${firstMigration}`);
const timestamp = dayjs().format('YYYYMMDDHHmm');

fs.writeFileSync(`./src/migrations/M${timestamp}NewMigrationName.ts`, firstMigrationCode);
