import container from '@container';
import { metricContractTableName } from '@models/Metric/Entity';
import BN from 'bignumber.js';
import * as uuid from 'uuid';

export interface Params {
  contract: string;
  metric: string;
  op: '>' | '>=' | '<' | '<=' | '!=' | '==';
  value: string;
}

export function paramsVerify(params: any): params is Params {
  const { contract, metric, op, value } = params;
  if (typeof contract !== 'string' || !uuid.validate(contract)) {
    throw new Error('Invalid contract');
  }
  if (
    typeof metric !== 'string' ||
    !['tvl', 'aprDay', 'aprWeek', 'aprMonth', 'aprYear'].includes(metric)
  ) {
    throw new Error('Invalid metric');
  }
  if (typeof op !== 'string' || !['>', '>=', '<', '<=', '!=', '=='].includes(op)) {
    throw new Error('Invalid operator');
  }
  if (typeof value !== 'string' || new BN(value).isNaN()) {
    throw new Error('Invalid value');
  }

  return true;
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
