import { Container, singleton, singletonParametric } from '@services/Container';
import {
  contractLastMetricLoader,
  contractLoader,
  contractUserLastMetricLoader,
  protocolFavoritesLoader,
  protocolLastMetricLoader,
  protocolUserLastAPRLoader,
  protocolUserLastMetricLoader,
} from './protocol';
import { tokenAliasLoader } from './token';
import {
  userBlockchainLoader,
  userLastAPRLoader,
  userLastMetricLoader,
  userTokenLastMetricLoader,
  walletLastMetricLoader,
  walletLoader,
  walletTokenLastMetricLoader,
} from './user';

export class DataLoaderContainer extends Container<{}> {
  readonly protocolFavorites = singletonParametric(protocolFavoritesLoader);

  readonly protocolMetric = singletonParametric(protocolLastMetricLoader);

  readonly protocolUserMetric = singletonParametric(protocolUserLastMetricLoader);

  readonly protocolUserAPRMetric = singletonParametric(protocolUserLastAPRLoader);

  readonly contract = singleton(contractLoader);

  readonly contractMetric = singleton(contractLastMetricLoader);

  readonly contractUserMetric = singletonParametric(contractUserLastMetricLoader);

  readonly userBlockchains = singleton(userBlockchainLoader);

  readonly userMetric = singletonParametric(userLastMetricLoader);

  readonly userAPRMetric = singletonParametric(userLastAPRLoader);

  readonly userTokenMetric = singletonParametric(userTokenLastMetricLoader);

  readonly wallet = singleton(walletLoader);

  readonly walletMetric = singleton(walletLastMetricLoader);

  readonly walletTokenMetric = singletonParametric(walletTokenLastMetricLoader);

  readonly tokenAlias = singleton(tokenAliasLoader);
}
