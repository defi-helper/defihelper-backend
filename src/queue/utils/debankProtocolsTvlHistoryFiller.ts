import container from '@container';
import { Process } from '@models/Queue/Entity';
import BN from 'bignumber.js';
import axios from 'axios';

interface Params {
  id: string;
}

interface TvlHistoryPoint {
  date_at: string;
  value: number;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const metricsService = container.model.metricService();
  const protocol = await container.model.protocolTable().where('id', id).first();

  if (!protocol || !protocol.debankId) {
    throw new Error('protocol not found or unsupported');
  }

  const tvlHistory = (
    (await axios.get(`https://openapi.debank.com/v1/protocol/tvl?id=${protocol.debankId}`))
      .data as TvlHistoryPoint[]
  ).map((v) => {
    return {
      at: new Date(v.date_at),
      tvl: new BN(v.value).toString(10),
    };
  });

  await Promise.all(
    tvlHistory.map((v) => {
      return metricsService.createProtocol(
        protocol,
        {
          tvl: v.tvl,
        },
        v.at,
      );
    }),
  );

  return process.done();
};
