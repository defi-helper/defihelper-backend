import container from '@container';
import { UserNotification } from '@models/UserNotification/Entity';
import { Process } from '@models/Queue/Entity';

export interface UserNotificationLegacy extends UserNotification {
  user: string | null;
}

export default async (process: Process) => {
  const tokensAlias = await container.model.tokenAliasTable().whereNull('logoUrl');
  const targetTokens = await container.model.tokenTable().whereIn(
    'alias',
    tokensAlias.map((tokenAlias) => tokenAlias.id),
  );

  await Promise.all(
    tokensAlias.map(async (notification) => {
      const tokensList = targetTokens.filter((token) => token.alias === notification.id);
      return await Promise.all(
        tokensList.map(({ alias: aliasId, network, address }) =>
          container.model.queueService().push('resolveTokenAliasLiquidity', {
            aliasId,
            network,
            address,
          }),
        ),
      );
    }),
  );
  return process.done();
};
