import { Process } from '@models/Queue/Entity';
import container from '@container';
import BigNumber from 'bignumber.js';

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

  const routerByNetwork = {
    '1': '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    '10': '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    '25': '0xcd7d16fB918511BF7269eC4f48d61D79Fb26f918',
    '56': '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    '137': '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
    '250': '0xF491e7B69E4244ad4002BC14e878a34207E38c29',
    '42161': '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
    '43114': '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106',
    '1313161554': '0xA1B1742e9c32C7cAa9726d8204bD5715e3419861',
  };

  const routerAddress = routerByNetwork[token.network as keyof typeof routerByNetwork];
  if (!routerAddress) {
    throw new Error(`No router found for ${token.network}`);
  }

  const blockchainContainer = container.blockchain.ethereum;
  const networkContainer = blockchainContainer.byNetwork(token.network);
  const provider = networkContainer.provider();
  const uniV2RouterContract = blockchainContainer.contract(
    routerAddress,
    blockchainContainer.abi.uniswapRouterABI,
    provider,
  );

  const wrappedNative = networkContainer.nativeTokenDetails.wrapped;
  if (!wrappedNative) {
    throw new Error('Wrapped token does not exist');
  }

  const possibleRoutes = networkContainer.stablecoins.flatMap((stablecoin) => {
    return [
      [token.address, stablecoin],
      [token.address, wrappedNative, stablecoin],
    ];
  });
  const route = await possibleRoutes.reduce<Promise<string[] | null>>(
    async (prev, possibleRoute) => {
      const aPrev = await prev;
      if (aPrev !== null) {
        return aPrev;
      }

      return uniV2RouterContract
        .getAmountsOut(new BigNumber(`1e${token.decimals}`).toFixed(0), possibleRoute)
        .then(() => possibleRoute)
        .catch(() => null);
    },
    Promise.resolve(null),
  );

  if (!route) {
    throw new Error(`Could not find a route`);
  }

  const representativeTokenErc20Contract = blockchainContainer.contract(
    route[route.length - 1],
    blockchainContainer.abi.erc20ABI,
    provider,
  );

  const outputDecimals = await representativeTokenErc20Contract.decimals();

  await container.model.tokenService().update({
    ...token,
    priceFeedNeeded: false,
    priceFeed: {
      type: 'uniswapRouterV2',
      route,
      routerAddress,
      outputDecimals,
    },
  });

  return process.done();
};
