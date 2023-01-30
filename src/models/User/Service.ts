import { Factory } from '@services/Container';
import { Locale } from '@services/I18n/container';
import { RedisClient } from 'redis';
import { v4 as uuid } from 'uuid';
import dayjs from 'dayjs';
import { Emitter } from '@services/Event';
import container from '@container';
import { ReferrerCode } from '@models/ReferrerCode/Entity';
import { Wallet } from '@models/Wallet/Entity';
import { WalletService } from '@models/Wallet/Service';
import { User, Table as UserTable, Role } from './Entity';

export class UserService {
  public readonly onCreated = new Emitter<User>((user) =>
    container.model.queueService().push(
      'eventsUserCreated',
      {
        id: user.id,
      },
      { startAt: dayjs().add(5, 'seconds').toDate() },
    ),
  );

  public readonly onAuth = new Emitter<User>();

  constructor(
    readonly table: Factory<UserTable>,
    readonly session: Factory<SessionService>,
    readonly walletService: Factory<WalletService>,
  ) {}

  async create(role: Role, timezone: string, codeRecord?: ReferrerCode, locale: Locale = 'enUS') {
    const created: User = {
      id: uuid(),
      role,
      name: '',
      locale,
      referrer: codeRecord?.id ?? null,
      isPorfolioCollected: false,
      isMetricsTracked: true,
      timezone,
      authAt: new Date(),
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.table().insert(created);
    this.onCreated.emit(created);

    return created;
  }

  async update(user: User) {
    const updated: User = {
      ...user,
      updatedAt: new Date(),
    };
    await this.table().where({ id: user.id }).update(updated);

    return updated;
  }

  async portfolioCollectedSuccessful(user: User) {
    if (user.isPorfolioCollected) return user;

    const updated = await this.update({
      ...user,
      isPorfolioCollected: true,
    });

    return updated;
  }

  async delete(contract: User) {
    await this.table().where({ id: contract.id }).delete();
  }

  async auth(user: User, wallet?: Wallet) {
    const sid = this.session().generate(user);
    if (wallet) {
      await this.update({ ...user, authAt: new Date() });
      if (wallet.deletedAt !== null) {
        await this.walletService().updateWallet({ ...wallet, deletedAt: null });
      }
    }
    this.onAuth.emit(user);
    return { user, sid };
  }
}

export class SessionService {
  constructor(
    readonly cache: Factory<RedisClient>,
    readonly prefix: string,
    readonly ttl: number,
  ) {}

  generate(user: User) {
    const cache = this.cache();
    const sid = uuid();
    const key = `${this.prefix}:${sid}`;
    cache.set(key, user.id);
    cache.expire(key, this.ttl);

    return sid;
  }

  get(sid: string): Promise<string | null> {
    const cache = this.cache();
    const key = `${this.prefix}:${sid}`;

    return new Promise((resolve, reject) =>
      cache.get(key, (err, id) => {
        if (err) return reject(err);
        if (id) cache.expire(key, this.ttl);

        return resolve(id);
      }),
    );
  }
}
