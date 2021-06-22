import { Container, singleton } from '@services/Container';
import config from './config';
import { pgConnectFactory } from '@services/Database';
import { consoleFactory } from '@services/Log';
import * as Blockchain from '@services/Blockchain';
import { ModelContainer } from '@models/container';
import { redisConnectFactory } from '@services/Cache';

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

  readonly model = new ModelContainer(this);
}

export default new AppContainer(config);
