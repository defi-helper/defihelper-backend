import { Process } from '@models/Queue/Entity';
import axios from 'axios';
import container from '@container';
import { ethers } from 'ethers';

const protocolName = 'QuickSwap';
const adapterName = 'quickswap';
const protocolDescription = 'QuickSwap Farm';

const stakingAdapterName = 'polygonStakingRewards';

const quickToken = '0x831753dd7087cac61ab5644b308642cc1c33dc13';

const tokenExistsOnCoingecko = async (address: string) => {
  if (address.toLowerCase() === quickToken) {
    return true;
  }
  try {
    const res = await axios.get(
      `https://api.coingecko.com/api/v3/coins/polygon-pos/contract/${address.toLowerCase()}`,
      {
        validateStatus: () => true,
      },
    );
    return res.status < 400;
  } catch (e) {
    container.logger().error(`${e}`);
    return false;
  }
};

const extractSymbolsFromAddress = async (
  address: string,
  provider: ethers.providers.JsonRpcProvider,
): Promise<string | undefined> => {
  const pair = container.blockchain.ethereum.contract(
    address,
    container.blockchain.ethereum.abi.uniswapV2PairABI,
    provider,
  );

  let token0: string;
  let token1: string;

  try {
    [token0, token1] = await Promise.all([pair.token0(), pair.token1()]);
  } catch {
    const symbol = container.blockchain.ethereum
      .contract(address, container.blockchain.ethereum.abi.erc20ABI, provider)
      .symbol()
      .catch(() => undefined);

    if (symbol) {
      return (await tokenExistsOnCoingecko(address)) ? symbol : undefined;
    }

    return undefined;
  }

  if (!(await tokenExistsOnCoingecko(token0)) || !(await tokenExistsOnCoingecko(token1))) {
    return undefined;
  }

  const [symbol0, symbol1] = await Promise.all([
    container.blockchain.ethereum
      .contract(token0, container.blockchain.ethereum.abi.erc20ABI, provider)
      .symbol(),
    container.blockchain.ethereum
      .contract(token1, container.blockchain.ethereum.abi.erc20ABI, provider)
      .symbol(),
  ]);

  return `${symbol0}/${symbol1} LP`;
};

export default async (process: Process) => {
  let protocol = await container.model.protocolTable().where('name', protocolName).first();

  if (!protocol) {
    protocol = await container.model
      .protocolService()
      .create(adapterName, protocolName, protocolDescription, null, null, {}, false);
  }

  const res = await axios.get<string>(
    `https://raw.githubusercontent.com/vfat-tools/vfat-tools/master/src/static/js/matic_quick.js`,
  );
  const addresses = res.data.matchAll(/stakingRewardAddress: "(.*)"/g);

  const blockchain = container.blockchain.ethereum;
  const provider = blockchain.byNetwork('137').provider();

  const activePools = (
    await Promise.all(
      [...addresses].map(async (address): Promise<string | undefined> => {
        const synthetixStakingContract = container.blockchain.ethereum.contract(
          address[1],
          container.blockchain.ethereum.abi.synthetixStaking,
          provider,
        );

        // In case we are trying to call not a SynthetixStaking
        try {
          const periodFinish = await synthetixStakingContract.periodFinish();

          if (periodFinish * 1000 <= Date.now()) {
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

      const synthetixStakingContract = container.blockchain.ethereum.contract(
        address,
        container.blockchain.ethereum.abi.synthetixStaking,
        provider,
      );

      let rewardToken;
      let stakedToken;
      // In case we are trying to call not a SynthetixStaking
      try {
        [rewardToken, stakedToken] = await Promise.all<string>([
          synthetixStakingContract.rewardsToken(),
          synthetixStakingContract.stakingToken(),
        ]);
      } catch (e) {
        return;
      }

      const rewardSymbol = await extractSymbolsFromAddress(rewardToken, provider);
      const stakedSymbol = await extractSymbolsFromAddress(stakedToken, provider);

      if (!rewardSymbol || !stakedSymbol) {
        return;
      }

      await container.model
        .contractService()
        .create(
          protocol,
          'ethereum',
          '137',
          address.toLowerCase(),
          null,
          stakingAdapterName,
          '',
          { adapters: [] },
          `Staking ${stakedSymbol} for ${rewardSymbol}`,
          '',
          `${container.blockchain.ethereum.networks[
            '137'
          ].walletExplorerURL.toString()}/${address}`,
          false,
          ['Staked'],
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
