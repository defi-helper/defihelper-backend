import { SchemaBuilder } from 'knex';
import container from '@container';
import { Role, tableName as userTableName } from '@models/User/Entity';
import { UserNotificationType } from '@models/UserNotification/Entity';

export default async (schema: SchemaBuilder) => {
  const users = await container.model.userTable().whereNot(`${userTableName}.role`, Role.Candidate);

  await Promise.all(
    users.map(async (u) =>
      container.model.userNotificationService().enable(u, UserNotificationType.PortfolioMetrics),
    ),
  );

  return schema;
};
