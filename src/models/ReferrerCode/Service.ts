import { Factory } from '@services/Container';
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
}
