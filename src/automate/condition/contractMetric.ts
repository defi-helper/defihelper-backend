import container from '@container';
import { metricContractTableName } from '@models/Metric/Entity';
import BN from 'bignumber.js';

interface Params {
  contract: string;
  metric: string;
  op: '>' | '>=' | '<' | '<=' | '!=' | '==';
  value: string;
}

export default async (params: Params) => {
  const db = container.database();
  const contract = await container.model
    .metricContractTable()
    .where('contract', params.contract)
    .andWhere(db.raw(`${metricContractTableName}.data->>'${params.metric}' IS NOT NULL`))
    .orderBy('date', 'DESC')
    .first();
  const metric = new BN(contract?.data[params.metric] ?? '0');
  const { value } = params;

  switch (params.op) {
    case '>':
      return metric.gt(value);
    case '>=':
      return metric.gte(value);
    case '<':
      return metric.lt(value);
    case '<=':
      return metric.lte(value);
    case '==':
      return metric.eq(value);
    case '!=':
      return !metric.eq(value);
    default:
      return false;
  }
};
