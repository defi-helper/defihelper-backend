import { Process } from '@models/Queue/Entity';
import axios from 'axios';
import container from '@container';

const protocolName = 'PancakeSwap';
const adapterName = 'pancakeswap';
const protocolDescription = 'PancakeSwap Farm';

const stakingAdapterName = 'smartChefInitializable';

export default async (process: Process) => {
  let protocol = await container.model.protocolTable().where('name', protocolName).first();

  if (!protocol) {
    protocol = await container.model
      .protocolService()
      .create(adapterName, protocolName, protocolDescription, null, null, null, {}, false);
  }

  const res = await axios.get<string>(
    `https://raw.githubusercontent.com/pancakeswap/pancake-frontend/develop/src/config/constants/pools.ts`,
  );
  const addresses = res.data.matchAll(/56: '(.*)'/g);

  const blockchain = container.blockchain.ethereum;
  const provider = blockchain.byNetwork('56').provider();

  const blockNumber = await provider.getBlockNumber();

  const activePools = (
    await Promise.all(
      [...addresses].map(async (address): Promise<string | undefined> => {
        const masterChiefContract = container.blockchain.ethereum.contract(
          address[1],
          container.blockchain.ethereum.abi.pancakeSmartChefInitializable,
          provider,
        );

        // In case we are trying to call not a SmartChefInitializable
        try {
          const bonusEndBlock = await masterChiefContract.bonusEndBlock();

          if (bonusEndBlock <= blockNumber) {
            return undefined;
          }
        } catch (e) {
          return undefined;
        }

        return address[1] || undefined;
      }),
    )
  ).filter((address) => address != null) as string[];

  const contracts = await container.model.contractTable().where('protocol', protocol.id).select();

  const newPools = activePools.filter(
    (pool) => !contracts.some((c) => c.address.toLowerCase() === pool.toLowerCase()),
  );
  const removedContracts = contracts.filter(
    (contract) => !activePools.some((p) => contract.address.toLowerCase() === p.toLowerCase()),
  );

  await Promise.all(
    newPools.map(async (address) => {
      if (!protocol) {
        return;
      }

      const masterChiefContract = container.blockchain.ethereum.contract(
        address,
        container.blockchain.ethereum.abi.pancakeSmartChefInitializable,
        provider,
      );

      let rewardToken;
      let stakedToken;
      // In case we are trying to call not a SmartChefInitializable
      try {
        [rewardToken, stakedToken] = await Promise.all<string>([
          masterChiefContract.rewardToken(),
          masterChiefContract.stakedToken(),
        ]);
      } catch (e) {
        return;
      }

      const [rewardSymbol, stakedSymbol] = await Promise.all<string>([
        container.blockchain.ethereum
          .contract(rewardToken, container.blockchain.ethereum.abi.erc20ABI, provider)
          .symbol(),
        container.blockchain.ethereum
          .contract(stakedToken, container.blockchain.ethereum.abi.erc20ABI, provider)
          .symbol(),
      ]);

      await container.model
        .contractService()
        .create(
          protocol,
          'ethereum',
          '56',
          address.toLowerCase(),
          null,
          stakingAdapterName,
          '',
          { adapters: [] },
          `Staking ${stakedSymbol} for ${rewardSymbol}`,
          '',
          `${container.blockchain.ethereum.networks['56'].walletExplorerURL.toString()}/${address}`,
          false,
          ['Deposit'],
        );
    }),
  );

  await Promise.all(
    removedContracts.map(async (contract) => {
      if (!protocol) {
        return;
      }

      await container.model
        .contractTable()
        .update({
          hidden: true,
        })
        .where('id', contract.id);
    }),
  );

  return process.done();
};
