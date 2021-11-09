import { Container, singleton, singletonParametric } from '@services/Container';
import {
  contractLastMetricLoader,
  contractUserLastMetricLoader,
  protocolFavoritesLoader,
  protocolLastMetricLoader,
  protocolUserLastAPRLoader,
  protocolUserLastMetricLoader,
} from './protocol';
import { userBlockchainLoader, userLastAPRLoader, userLastMetricLoader } from './user';

export class DataLoaderContainer extends Container<{}> {
  readonly protocolFavorites = singletonParametric(protocolFavoritesLoader);

  readonly protocolMetric = singletonParametric(protocolLastMetricLoader);

  readonly protocolUserMetric = singletonParametric(protocolUserLastMetricLoader);

  readonly protocolUserAPRMetric = singletonParametric(protocolUserLastAPRLoader);

  readonly contractMetric = singletonParametric(contractLastMetricLoader);

  readonly contractUserMetric = singletonParametric(contractUserLastMetricLoader);

  readonly userBlockchains = singleton(userBlockchainLoader);

  readonly userMetric = singletonParametric(userLastMetricLoader);

  readonly userAPRMetric = singletonParametric(userLastAPRLoader);
}
