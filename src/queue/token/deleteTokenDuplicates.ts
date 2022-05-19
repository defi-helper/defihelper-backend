import container from '@container';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const db = container.database();
  const candidates = await container.model
    .tokenTable()
    .column('network')
    .column(db.raw('lower(address) as address'))
    .groupBy('network', db.raw('lower(address)'))
    .having(db.raw('count(id)'), '>', 1);
  await candidates.reduce<Promise<any>>(async (prev, { network, address }: any) => {
    await prev;

    const [baseToken, ...duplicatesTokens] = await container.model
      .tokenTable()
      .where('network', network)
      .where(db.raw('lower(address)'), '=', address)
      .orderBy('createdAt', 'asc');

    const duplicatesTokensIds = duplicatesTokens.map(({ id }) => id);
    await Promise.all([
      container.model
        .tokenContractLinkTable()
        .update('token', baseToken.id)
        .whereIn('token', duplicatesTokensIds),
      container.model
        .metricTokenTable()
        .update('token', baseToken.id)
        .whereIn('token', duplicatesTokensIds),
      container.model
        .metricWalletTokenTable()
        .update('token', baseToken.id)
        .whereIn('token', duplicatesTokensIds),
    ]);
    await container.model.tokenTable().whereIn('id', duplicatesTokensIds).delete();
  }, Promise.resolve(null));

  return process.done();
};
