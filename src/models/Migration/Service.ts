import Knex from 'knex';
import { Factory } from '@services/Container';
import { Log } from '@services/Log';
import { Table, migrate } from './Entity';
import { readdir } from 'fs';

export interface MigrationHandler {
  (schema: Knex.SchemaBuilder): Promise<void>;
}

export interface MigrationHandlerList {
  [name: string]: MigrationHandler;
}

export function factory(
  logger: Factory<Log>,
  database: Factory<Knex>,
  table: Factory<Table>,
  dir: string,
  pattern: RegExp = /^M[0-9]+[A-Za-z0-9_]+\.(ts|js)$/i,
) {
  return () => new MigrationService(logger, database, table, dir, pattern);
}

export class MigrationService {
  constructor(
    readonly logger: Factory<Log> = logger,
    readonly database: Factory<Knex> = database,
    readonly table: Factory<Table> = table,
    readonly dir: string,
    readonly pattern: RegExp,
  ) {}

  private async getMigrations(): Promise<MigrationHandlerList> {
    return new Promise((resolve, reject) => {
      readdir(this.dir, (err, files) => {
        if (err) return reject(new Error(`Migrations dir ${this.dir} not found`));

        files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        return resolve(
          files
            .filter((filepath) => this.pattern.test(filepath))
            .reduce(
              (migrations, filepath) => ({
                ...migrations,
                [filepath]: require(`${this.dir}/${filepath}`).default,
              }),
              {},
            ),
        );
      });
    });
  }

  private async getCompleted(): Promise<string[]> {
    const completed = await this.table().select('name');

    return completed.map(({ name }) => name);
  }

  async init() {
    return migrate(this.logger, this.database);
  }

  async up() {
    await this.init();

    const [completed, migrations] = await Promise.all([this.getCompleted(), this.getMigrations()]);
    const candidates = Object.entries(migrations).filter(([name]) => !completed.includes(name));
    if (Object.keys(candidates).length === 0) return this;

    this.logger().info('Migrations up');

    candidates.reverse();
    const queue = candidates.reduce(
      (next, [name, migration]) =>
        async () => {
          this.logger().info(`Migration up: ${name}`);
          await migration(this.database().schema);
          await this.table().insert({
            name,
            createdAt: new Date(),
          });
          await next();
        },
      () => {
        this.logger().info('Migrations completed');
      },
    );

    return queue();
  }
}
