import { Container, singleton, singletonParametric } from '@services/Container';
import { SocialStatsGateway } from '@services/SocialStats';
import { TreasuryService } from '@services/Treasury';
import { pgConnectFactory } from '@services/Database';
import { consoleFactory } from '@services/Log';
import * as Blockchain from '@services/Blockchain';
import { I18nContainer } from '@services/I18n/container';
import { ModelContainer } from '@models/container';
import { redisConnectFactory, redisLockFactory, redisSubscriberFactory } from '@services/Cache';
import { ACLContainer } from '@services/ACL/container';
import { TemplateContainer } from '@services/Template/container';
import { emailServiceFactory } from '@services/Email';
import { telegramServiceFactory } from '@services/Telegram';
import { watcherServiceFactory } from '@services/Watcher';
import { rabbitmqFactory } from '@services/Rabbitmq';
import { cryptographyServiceFactory } from '@services/Cryptography';
import { cexServicesProviderFactory } from '@services/Cex';
import { debankServiceFactory } from '@services/Debank';
import config from './config';

class AppContainer extends Container<typeof config> {
  readonly logger = singleton(consoleFactory());

  readonly database = singleton(pgConnectFactory(this.parent.database));

  readonly rabbitmq = singleton(rabbitmqFactory(this.parent.rabbitmq));

  readonly cache = singleton(redisConnectFactory(this.parent.cache));

  readonly cacheSubscriber = singletonParametric(redisSubscriberFactory(this.cache, 100));

  readonly semafor = singleton(redisLockFactory(this.cache));

  readonly email = singleton(emailServiceFactory(this.parent.email));

  readonly telegram = singleton(telegramServiceFactory(this.parent.telegram.token));

  readonly cexServicesProvider = singleton(cexServicesProviderFactory());

  readonly watcher = singleton(watcherServiceFactory(this.parent.watcher));

  readonly cryptography = singleton(cryptographyServiceFactory(this.parent.cryptography.key));

  readonly debank = singleton(debankServiceFactory());

  readonly socialStats = singleton(() => new SocialStatsGateway(this.parent.socialStats));

  readonly blockchain = {
    ethereum: new Blockchain.Ethereum.BlockchainContainer(this.parent.blockchain.ethereum),
    waves: new Blockchain.Waves.BlockchainContainer(this.parent.blockchain.waves),
  };

  readonly blockchainAdapter = new Blockchain.Adapter.AdapterService(this.parent.adapters.host);

  readonly i18n = new I18nContainer(this);

  readonly acl = new ACLContainer(this);

  readonly template = new TemplateContainer(this);

  readonly treasury = singleton(() => new TreasuryService(this.cache, 'defihelper:treasury', 60));

  readonly model = new ModelContainer(this);
}

export default new AppContainer(config);
