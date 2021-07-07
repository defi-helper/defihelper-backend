import { Container, singleton } from '@services/Container';
import config from './config';
import { pgConnectFactory } from '@services/Database';
import { consoleFactory } from '@services/Log';
import * as Blockchain from '@services/Blockchain';
import { I18nContainer } from '@services/I18n/container';
import { ModelContainer } from '@models/container';
import { redisConnectFactory } from '@services/Cache';
import { ACLContainer } from '@services/ACL/container';

class AppContainer extends Container<typeof config> {
  readonly logger = singleton(consoleFactory());

  readonly database = singleton(pgConnectFactory(this.parent.database));

  readonly cache = singleton(redisConnectFactory(this.parent.cache));

  readonly blockchain = {
    ethereum: new Blockchain.Ethereum.BlockchainContainer(this.parent.blockchain.ethereum),
    waves: new Blockchain.Waves.BlockchainContainer({
      mainNode: '',
      testNode: '',
    }),
  };

  readonly i18n = new I18nContainer(this);

  readonly acl = new ACLContainer(this);

  readonly model = new ModelContainer(this);
}

export default new AppContainer(config);
