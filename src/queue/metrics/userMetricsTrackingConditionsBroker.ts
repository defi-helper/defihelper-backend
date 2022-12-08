import container from '@container';
import { ContactStatus, userContactTableName } from '@models/Notification/Entity';
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
        .distinct(`${userTableName}.id`)
        .leftJoin(userContactTableName, function () {
          this.on(`${userContactTableName}.user`, '=', `${userTableName}.id`);
          this.onIn(`${userContactTableName}.status`, [ContactStatus.Active]);
        })
        .whereRaw(`(CURRENT_TIMESTAMP::date - "${userTableName}"."createdAt"::date) > 7`)
        .where(`${userTableName}.isMetricsTracked`, true)
        .havingRaw(`count(${userContactTableName}.id) = 0`)
        .groupBy(`${userTableName}.id`),
    );

  return process.done();
};
