import { Process } from '@models/Queue/Entity';
import container from '@container';
import BN from 'bignumber.js';
import { TokenAliasLiquidity, tokenAliasTableName, tokenTableName } from '@models/Token/Entity';
import { ethers } from 'ethers';

const routersByNetwork: Record<string, string[] | undefined> = {
  '1': ['0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'],
  '10': ['0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'],
  '25': ['0xcd7d16fB918511BF7269eC4f48d61D79Fb26f918'],
  '56': ['0x10ED43C718714eb63d5aA57B78B54704E256024E'],
  '137': ['0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32'],
  '250': ['0xF491e7B69E4244ad4002BC14e878a34207E38c29'],
  '42161': ['0xc35DADB65012eC5796536bD9864eD8773aBc74C4'],
  '43114': ['0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106'],
  '1313161554': ['0xA1B1742e9c32C7cAa9726d8204bD5715e3419861'],
};

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const token = await container.model.tokenTable().where('id', id).first();
  if (!token) {
    throw new Error('Token not found');
  }
  if (token.priceFeed !== null) {
    throw new Error('Price feed already exists');
  }
  if (token.blockchain !== 'ethereum') {
    throw new Error('Blockchain not supported');
  }

  const blockchainContainer = container.blockchain.ethereum;
  const networkContainer = blockchainContainer.byNetwork(token.network);
  const provider = networkContainer.provider();
  const wrappedNative = networkContainer.nativeTokenDetails.wrapped;
  if (!wrappedNative) {
    throw new Error('Wrapped token does not exist');
  }

  const stablecoins = await container.model
    .tokenTable()
    .column<Array<{ address: string }>>(`${tokenTableName}.address`)
    .innerJoin(tokenAliasTableName, `${tokenAliasTableName}.id`, `${tokenTableName}.alias`)
    .where(`${tokenAliasTableName}.liquidity`, TokenAliasLiquidity.Stable)
    .where(`${tokenTableName}.blockchain`, 'ethereum')
    .where(`${tokenTableName}.network`, token.network)
    .then((tokens) => tokens.map(({ address }) => address));

  const possibleRoutes = stablecoins.flatMap((stablecoin) => [
    [token.address, stablecoin],
    [token.address, wrappedNative, stablecoin],
  ]);

  const availableRouters = routersByNetwork[token.network];
  if (!availableRouters) {
    throw new Error(`No routers found for ${token.network}`);
  }

  const route = await possibleRoutes.reduce<
    Promise<{
      router: string;
      route: string[];
    } | null>
  >(async (prev, possibleRoute) => {
    const res = await prev;
    if (res !== null) return res;

    const routerAddress = await availableRouters.reduce<Promise<string | null>>(
      async (routerPrev, possibleRouter) => {
        const routerRes = await routerPrev;
        if (routerRes !== null) return routerRes;

        const amountsOut = await blockchainContainer
          .contract(possibleRouter, blockchainContainer.abi.uniswapRouterABI, provider)
          .getAmountsOut(new BN(`1e${token.decimals}`).toFixed(0), possibleRoute)
          .catch(() => null);
        if (amountsOut === null) return null;
        if (amountsOut[amountsOut.length - 1].toString() === '0') return null;

        return possibleRouter;
      },
      Promise.resolve(null),
    );
    if (!routerAddress) return null;

    return {
      router: routerAddress,
      route: possibleRoute,
    };
  }, Promise.resolve(null));
  if (!route) {
    throw new Error('Could not find a route');
  }

  const [inputDecimals, outputDecimals] = await Promise.all([
    blockchainContainer
      .contract(route.route[0], blockchainContainer.abi.erc20ABI, provider)
      .decimals()
      .then((v: ethers.BigNumber) => Number(v.toString())),
    blockchainContainer
      .contract(route.route[route.route.length - 1], blockchainContainer.abi.erc20ABI, provider)
      .decimals()
      .then((v: ethers.BigNumber) => Number(v.toString())),
  ]);

  await container.model.tokenService().update({
    ...token,
    priceFeedNeeded: false,
    priceFeed: {
      type: 'uniswapRouterV2',
      route: route.route,
      routerAddress: route.router,
      inputDecimals,
      outputDecimals,
    },
  });

  return process.done();
};
