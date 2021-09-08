import { Container, singleton } from '@services/Container';
import { pgConnectFactory } from '@services/Database';
import { consoleFactory } from '@services/Log';
import * as Blockchain from '@services/Blockchain';
import { I18nContainer } from '@services/I18n/container';
import { ModelContainer } from '@models/container';
import { redisConnectFactory, redisLockFactory } from '@services/Cache';
import { ACLContainer } from '@services/ACL/container';
import { TemplateContainer } from '@services/Template/container';
import { emailServiceFactory } from '@services/Email';
import { telegramServiceFactory } from '@services/Telegram';
import { scannerServiceFactory } from '@services/Scanner';
import config from './config';

class AppContainer extends Container<typeof config> {
  readonly logger = singleton(consoleFactory());

  readonly database = singleton(pgConnectFactory(this.parent.database));

  readonly cache = singleton(redisConnectFactory(this.parent.cache));

  readonly semafor = singleton(redisLockFactory(this.cache));

  readonly email = singleton(emailServiceFactory(this.parent.email));

  readonly telegram = singleton(telegramServiceFactory(this.parent.telegram.token));

  readonly scanner = singleton(scannerServiceFactory(this.parent.scanner));

  readonly blockchain = {
    ethereum: new Blockchain.Ethereum.BlockchainContainer(this.parent.blockchain.ethereum),
    waves: new Blockchain.Waves.BlockchainContainer({
      mainNode: '',
      testNode: '',
    }),
  };

  readonly blockchainAdapter = new Blockchain.Adapter.AdapterService(this.parent.adapters.host);

  readonly i18n = new I18nContainer(this);

  readonly acl = new ACLContainer(this);

  readonly template = new TemplateContainer(this);

  readonly model = new ModelContainer(this);
}

export default new AppContainer(config);
