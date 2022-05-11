import { User } from '@models/User/Entity';
import { Factory } from '@services/Container';
import { nanoid } from 'nanoid';
import { v4 as uuid } from 'uuid';
import { ReferrerCode, ReferrerCodeTable } from './Entity';

export class ReferrerCodeService {
  constructor(readonly table: Factory<ReferrerCodeTable>) {}

  async touch(code: ReferrerCode) {
    const nextNumber = await this.table().increment('usedTimes').where({
      id: code.id,
    });

    return {
      ...code,
      usedTimes: nextNumber,
    };
  }

  async visit(code: ReferrerCode) {
    const nextNumber = await this.table().increment('visits').where({
      id: code.id,
    });

    return {
      ...code,
      visits: nextNumber,
    };
  }

  async generate({ id: user }: User, redirectTo: string = 'https://app.defihelper.io/portfolio') {
    const created = {
      id: uuid(),
      user,
      code: nanoid(6),
      redirectTo,
      usedTimes: 0,
      createdAt: new Date(),
    };

    await this.table().insert(created);
    return created;
  }
}
