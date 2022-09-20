import container from '@container';
import DataLoader from 'dataloader';
import { Tag, tagTableName } from '@models/Tag/Entity';
import { tagContractLinkTableName } from '@models/Protocol/Entity';

export const tagContractLoader = () =>
  new DataLoader<string, Tag | null>(async (contactsIds) => {
    const map = await container.model
      .tagTable()
      .column(`${tagTableName}.*`)
      .innerJoin(tagContractLinkTableName, `${tagContractLinkTableName}.tag`, `${tagTableName}.id`)
      .whereIn(`${tagContractLinkTableName}.contract`, contactsIds)
      .then((rows) => new Map(rows.map((tag) => [tag.id, tag])));

    return contactsIds.map((id) => map.get(id) ?? null);
  });
