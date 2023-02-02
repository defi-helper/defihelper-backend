import { Container, singleton, singletonParametric } from '@services/Container';
import {
  automateContractStopLossLoader,
  automateContractTriggerLoader,
  automateInvestHistoryLoader,
} from './automate';
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
import { tagContractLoader } from './tag';
import {
  tokenAliasLoader,
  tokenAliasUserLastMetricLoader,
  tokenChildLoader,
  tokenContractLoader,
  tokenLastMetricLoader,
  tokenLoader,
} from './token';

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
  walletRegistryLoader,
} from './user';

export class DataLoaderContainer extends Container<{}> {
  readonly protocol = singleton(protocolLoader);

  readonly tag = singleton(tagContractLoader);

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

  readonly walletRegistry = singleton(walletRegistryLoader);

  readonly walletTokenMetric = singletonParametric(walletTokenLastMetricLoader);

  readonly walletTriggersCount = singleton(walletTriggersCountLoader);

  readonly walletAutomates = singleton(walletAutomatesLoader);

  readonly tokenAlias = singleton(tokenAliasLoader);

  readonly tokenAliasUserLastMetric = singletonParametric(tokenAliasUserLastMetricLoader);

  readonly tokenLastMetric = singleton(tokenLastMetricLoader);

  readonly token = singleton(tokenLoader);

  readonly tokenChild = singleton(tokenChildLoader);

  readonly tokenContract = singletonParametric(tokenContractLoader);

  readonly automateContractStopLoss = singleton(automateContractStopLossLoader);

  readonly automateContractTrigger = singleton(automateContractTriggerLoader);

  readonly automateInvestHistory = singleton(automateInvestHistoryLoader);
}
