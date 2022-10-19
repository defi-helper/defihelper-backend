import { Container, singleton, singletonParametric } from '@services/Container';
import { automateContractStopLossLoader } from './automate';
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
import { tokenAliasLoader, tokenAliasUserLastMetricLoader, tokenLoader } from './token';
import {
  userBlockchainLoader,
  userLastAPRLoader,
  userLastMetricLoader,
  userLoader,
  userTokenLastMetricLoader,
  walletLastMetricLoader,
  walletLoader,
  walletTokenLastMetricLoader,
  walletTriggersCountLoader,
  walletAutomatesLoader,
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

  readonly user = singleton(userLoader);

  readonly userBlockchains = singleton(userBlockchainLoader);

  readonly userMetric = singleton(userLastMetricLoader);

  readonly userAPRMetric = singletonParametric(userLastAPRLoader);

  readonly userTokenMetric = singletonParametric(userTokenLastMetricLoader);

  readonly wallet = singleton(walletLoader);

  readonly walletMetric = singleton(walletLastMetricLoader);

  readonly walletTokenMetric = singletonParametric(walletTokenLastMetricLoader);

  readonly walletTriggersCount = singleton(walletTriggersCountLoader);

  readonly walletAutomates = singleton(walletAutomatesLoader);

  readonly tokenAlias = singleton(tokenAliasLoader);

  readonly tokenAliasUserLastMetric = singletonParametric(tokenAliasUserLastMetricLoader);

  readonly token = singleton(tokenLoader);

  readonly automateContractStopLoss = singleton(automateContractStopLossLoader);
}
