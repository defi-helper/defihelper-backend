import { Factory } from '@services/Container';
import { v4 as uuid } from 'uuid';
import { Tag, TagPreservedName, TagTable } from '@models/Tag/Entity';
import { TagType } from './Entity';

export class TagService {
  constructor(readonly table: Factory<TagTable>) {}

  /**
   * @param name - Your own tag name or one of hardcoded(see TagPreservedName)
   */
  async firstOrCreate(type: TagType, name: string | TagPreservedName): Promise<Tag> {
    const duplicate = await this.table()
      .where({
        name,
      })
      .first();
    if (duplicate) {
      return duplicate;
    }

    const created: Tag = {
      id: uuid(),
      type,
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.table().insert(created);
    return created;
  }
}
