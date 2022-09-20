import { Factory } from '@services/Container';
import { v4 as uuid } from 'uuid';
import { Tag, TagTable, TagTypePair } from '@models/Tag/Entity';

export class TagService {
  constructor(readonly table: Factory<TagTable>) {}

  /**
   * Create tag with preserved name/type pair
   */
  async createPreserved(input: TagTypePair): Promise<Tag> {
    const duplicate = await this.table().where(input).first();
    if (duplicate) {
      return duplicate;
    }

    const created: Tag = {
      ...input,
      id: uuid(),
      createdAt: new Date(),
    };

    await this.table().insert(created);
    return created;
  }
}
