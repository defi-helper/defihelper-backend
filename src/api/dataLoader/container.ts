import { Container, singleton, singletonParametric } from '@services/Container';
import {
  contractLastMetricLoader,
  contractLoader,
  contractUserLastMetricLoader,
  protocolFavoritesLoader,
  protocolLastMetricLoader,
  protocolLoader,
  protocolUserLastAPRLoader,
  protocolUserLastMetricLoader,
} from './protocol';
import { tokenAliasLoader, tokenAliasUserLastMetricLoader } from './token';
import {
  userBlockchainLoader,
  userLastAPRLoader,
  userLastMetricLoader,
  userTokenLastMetricLoader,
  walletLastMetricLoader,
  walletLoader,
  walletTokenLastMetricLoader,
  walletTriggersCountLoader,
} from './user';

export class DataLoaderContainer extends Container<{}> {
  readonly protocol = singleton(protocolLoader);

  readonly protocolFavorites = singletonParametric(protocolFavoritesLoader);

  readonly protocolMetric = singletonParametric(protocolLastMetricLoader);

  readonly protocolUserMetric = singletonParametric(protocolUserLastMetricLoader);

  readonly protocolUserAPRMetric = singletonParametric(protocolUserLastAPRLoader);

  readonly contract = singleton(contractLoader);

  readonly contractMetric = singleton(contractLastMetricLoader);

  readonly contractUserMetric = singletonParametric(contractUserLastMetricLoader);

  readonly userBlockchains = singleton(userBlockchainLoader);

  readonly userMetric = singleton(userLastMetricLoader);

  readonly userAPRMetric = singletonParametric(userLastAPRLoader);

  readonly userTokenMetric = singletonParametric(userTokenLastMetricLoader);

  readonly wallet = singleton(walletLoader);

  readonly walletMetric = singleton(walletLastMetricLoader);

  readonly walletTokenMetric = singletonParametric(walletTokenLastMetricLoader);

  readonly walletTriggersCount = singleton(walletTriggersCountLoader);

  readonly tokenAlias = singleton(tokenAliasLoader);

  readonly tokenAliasUserLastMetric = singletonParametric(tokenAliasUserLastMetricLoader);
}
