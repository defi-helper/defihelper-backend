import { Process } from '@models/Queue/Entity';
import container from '@container';
import BigNumber from 'bignumber.js';
import { TokenAliasLiquidity, tokenAliasTableName, tokenTableName } from '@models/Token/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const token = await container.model.tokenTable().where('id', id).first();

  if (!token) {
    throw new Error(`Could not find token with id ${id}`);
  }

  if (token.priceFeed !== null) {
    throw new Error('Price feed already exists');
  }

  if (token.blockchain !== 'ethereum') {
    throw new Error('Blockchain not supported');
  }

  const routersByNetwork = {
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

  const stablecoins: string[] = await container.model
    .tokenAliasTable()
    .column(`${tokenTableName}.address`)
    .where('liquidity', TokenAliasLiquidity.Stable)
    .andWhere(`${tokenTableName}.blockchain`, 'ethereum')
    .innerJoin(tokenTableName, `${tokenAliasTableName}.id`, `${tokenTableName}.alias`)
    .andWhere(`${tokenTableName}.network`, token.network)
    .then((tokens) => tokens.map((v) => v.address));

  const possibleRoutes = stablecoins.flatMap((stablecoin) => {
    return [
      [token.address, stablecoin],
      [token.address, wrappedNative, stablecoin],
    ];
  });

  const availableRouters = routersByNetwork[token.network as keyof typeof routersByNetwork];
  if (!availableRouters) {
    throw new Error(`No routers found for ${token.network}`);
  }

  const blockchainContainer = container.blockchain.ethereum;
  const networkContainer = blockchainContainer.byNetwork(token.network);
  const provider = networkContainer.provider();

  const wrappedNative = networkContainer.nativeTokenDetails.wrapped as string;
  if (!wrappedNative) {
    throw new Error('Wrapped token does not exist');
  }

  const route = await possibleRoutes.reduce<
    Promise<{
      router: string;
      route: string[];
    } | null>
  >(async (prev, possibleRoute) => {
    const aPrev = await prev;
    if (aPrev !== null) {
      return aPrev;
    }

    const routerAddress = await availableRouters.reduce<Promise<string | null>>(
      async (routerPrev, possibleRouter) => {
        const aRouterPrev = await routerPrev;
        if (aRouterPrev !== null) {
          return aRouterPrev;
        }

        const uniV2RouterContract = blockchainContainer.contract(
          possibleRouter,
          blockchainContainer.abi.uniswapRouterABI,
          provider,
        );

        return uniV2RouterContract
          .getAmountsOut(new BigNumber(`1e${token.decimals}`).toFixed(0), possibleRoute)
          .then(() => possibleRouter)
          .catch(() => null);
      },
      Promise.resolve(null),
    );

    if (!routerAddress) {
      return null;
    }

    return {
      router: routerAddress,
      route: possibleRoute,
    };
  }, Promise.resolve(null));

  if (!route) {
    throw new Error(`Could not find a route`);
  }

  const representativeTokenErc20Contract = blockchainContainer.contract(
    route.route[route.route.length - 1],
    blockchainContainer.abi.erc20ABI,
    provider,
  );

  const outputDecimals = await representativeTokenErc20Contract.decimals();

  await container.model.tokenService().update({
    ...token,
    priceFeedNeeded: false,
    priceFeed: {
      type: 'uniswapRouterV2',
      route: route.route,
      routerAddress: route.router,
      outputDecimals,
    },
  });

  return process.done();
};
