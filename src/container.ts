import { Container, singleton, singletonParametric } from '@services/Container';
import { SocialStatsGateway } from '@services/SocialStats';
import { pgConnectFactory } from '@services/Database';
import { ConsoleLogger } from '@services/Log';
import * as Blockchain from '@services/Blockchain';
import { I18nContainer } from '@services/I18n/container';
import { ModelContainer } from '@models/container';
import { redisConnectFactory, redisLockFactory, redisSubscriberFactory } from '@services/Cache';
import { ACLContainer } from '@services/ACL/container';
import { TemplateContainer } from '@services/Template/container';
import { emailServiceFactory } from '@services/Email';
import { telegramServiceFactory } from '@services/Telegram';
import { ScannerService } from '@services/Scanner';
import { rabbitmqFactory } from '@services/Rabbitmq';
import { cryptographyServiceFactory } from '@services/Cryptography';
import { cexServicesProviderFactory } from '@services/Cex';
import { debankServiceFactory } from '@services/Debank';
import { wavesNodeGatewayFactory } from '@services/WavesNodeGateway';
import { WhatToFarmGateway } from '@services/WhatToFarm';
import { amplitudeFactory } from '@services/Amplitude';
import { Coingecko } from '@services/Coingecko';
import config from './config';

class AppContainer extends Container<typeof config> {
  readonly logger = singleton(() => new ConsoleLogger(this.parent.mode));

  readonly database = singleton(pgConnectFactory(this.parent.database));

  readonly rabbitmq = singleton(rabbitmqFactory(this.parent.rabbitmq));

  readonly cache = singleton(redisConnectFactory(this.parent.cache));

  readonly cacheSubscriber = singletonParametric(redisSubscriberFactory(this.cache, 100));

  readonly semafor = singleton(redisLockFactory(this.cache));

  readonly email = singleton(emailServiceFactory(this.parent.email));

  readonly cexServicesProvider = singleton(cexServicesProviderFactory());

  readonly scanner = singleton(ScannerService.factory(this.parent.scanner));

  readonly cryptography = singleton(cryptographyServiceFactory(this.parent.cryptography.key));

  readonly debank = singleton(debankServiceFactory(this.parent.debank.apiKey));

  readonly coingecko = singleton(() => new Coingecko());

  readonly waves = singleton(
    wavesNodeGatewayFactory(this.semafor, this.cache, this.debank, this.logger),
  );

  readonly whattofarm = singleton(() => new WhatToFarmGateway());

  readonly socialStats = singleton(() => new SocialStatsGateway(this.parent.socialStats));

  readonly amplitude = singleton(amplitudeFactory(this.parent.amplitudeApiKey));

  readonly blockchain = {
    ethereum: new Blockchain.Ethereum.BlockchainContainer(this.parent.blockchain.ethereum),
    waves: new Blockchain.Waves.BlockchainContainer(this.parent.blockchain.waves),
  };

  readonly blockchainAdapter = new Blockchain.Adapter.AdapterService(this.parent.adapters.host);

  readonly i18n = new I18nContainer(this);

  readonly acl = new ACLContainer(this);

  readonly template = new TemplateContainer(this);

  readonly model = new ModelContainer(this);

  readonly telegram = singleton(
    telegramServiceFactory(this.parent.telegram.token, this.template, this.i18n),
  );
}

export default new AppContainer(config);
