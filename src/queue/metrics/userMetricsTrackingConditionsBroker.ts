import container from '@container';
import { userContactTableName } from '@models/Notification/Entity';
import { Process } from '@models/Queue/Entity';
import { tableName as userTableName } from '@models/User/Entity';

export default async (process: Process) => {
  await container.model
    .userTable()
    .update({
      isMetricsTracked: false,
    })
    .whereIn(
      'id',
      container.model
        .userTable()
        .column(`${userTableName}.id`)
        .leftJoin(userContactTableName, `${userContactTableName}.user`, `${userTableName}.id`)
        .havingRaw(`count(${userContactTableName}.id) = 0`)
        .whereRaw(`(CURRENT_TIMESTAMP::date - "${userTableName}"."createdAt"::date) > 7`)
        .andWhere(`${userTableName}.isMetricsTracked`, true)
        .groupBy(`${userTableName}.id`),
    );

  return process.done();
};
