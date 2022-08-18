import container from '@container';
import { isKey } from '@services/types';
import contracts from '@defihelper/networks/contracts.json';
import { useEthereumFreeConsumer } from '@services/Blockchain/Consumer';
import { LogJsonMessage } from '@services/Log';
import { abi as BalanceABI } from '@defihelper/networks/abi/Balance.json';
import { abi as SmartTradeRouterABI } from '@defihelper/networks/abi/SmartTradeRouter.json';
import { abi as SmartTradeSwapHandlerABI } from '@defihelper/networks/abi/SmartTradeSwapHandler.json';
import { ethers } from 'ethers';
import dayjs from 'dayjs';
import { BigNumber as BN } from 'bignumber.js';
import { Order, SwapCallData } from '../Entity';
import UniswapRouterABI from '../data/uniswapRouterABI.json';

export default async function (
  order: Order<SwapCallData>,
): Promise<ethers.ContractTransaction | Error | null> {
  const log = LogJsonMessage.debug({ source: 'smartTradeSwapHandler' });
  log.ex({ orderId: order.id }).send();
  if (!isKey(contracts, order.network)) {
    return new Error('Contracts not deployed to target network');
  }
  const network = container.blockchain.ethereum.byNetwork(order.network);
  const provider = network.provider();
  const uniswapRouter = new ethers.Contract(order.callData.exchange, UniswapRouterABI, provider);
  const actualAmountOut = await uniswapRouter
    .getAmountsOut(order.callData.amountIn, order.callData.path)
    .then((amountsOut: ethers.BigNumber[]) => new BN(amountsOut[amountsOut.length - 1].toString()));
  log
    .ex({
      routesAmountOut: order.callData.routes.map((route, index) => ({
        index,
        amountOut: route?.amountOut,
        amountOutMin: route?.amountOutMin,
      })),
      actualAmountOut: actualAmountOut.toString(10),
    })
    .send();

  const routeIndex = order.callData.routes.reduce<number | null>((prev, route, index) => {
    if (prev !== null || route === null) return prev;
    if (
      (route.direction === 'gt' && actualAmountOut.lt(route.amountOut)) ||
      (route.direction === 'lt' && actualAmountOut.gt(route.amountOut))
    ) {
      return prev;
    }
    if (actualAmountOut.lt(route.amountOutMin)) {
      return prev;
    }

    return index;
  }, null);
  log.ex({ routeIndex }).send();
  if (routeIndex === null) return null;

  const freeConsumer = await useEthereumFreeConsumer(order.network);
  log.ex({ consumer: freeConsumer?.consumer.address }).send();
  if (freeConsumer === null) return new Error('Not free consumer');

  const networkContracts = contracts[order.network] as Record<
    string,
    { address: string } | undefined
  >;
  if (networkContracts.Balance === undefined) {
    return new Error('Balance contract not deployed to target network');
  }
  const balance = container.blockchain.ethereum.contract(
    networkContracts.Balance.address,
    BalanceABI,
    freeConsumer.consumer,
  );
  if (networkContracts.SmartTradeRouter === undefined) {
    return new Error('Smart trade router not deployed to target network');
  }
  const smartTradeRouter = container.blockchain.ethereum.contract(
    networkContracts.SmartTradeRouter.address,
    SmartTradeRouterABI,
    freeConsumer.consumer,
  );
  if (networkContracts.SmartTradeSwapHandler === undefined) {
    return new Error('Smart trade swap handler not deployed to target network');
  }
  const smartTradeHandler = container.blockchain.ethereum.contract(
    networkContracts.SmartTradeSwapHandler.address,
    SmartTradeSwapHandlerABI,
    freeConsumer.consumer,
  );

  const routerBalance = await smartTradeRouter
    .balanceOf(order.owner, order.callData.pair[0])
    .then((v: ethers.BigNumber) => v.toString());
  log.ex({ routerBalance }).send();
  if (new BN(order.callData.amountIn).gt(routerBalance)) {
    return new Error('Insufficient funds to swap');
  }

  const callOptions = await smartTradeHandler.callOptionsEncode({
    route: routeIndex,
    deadline: dayjs().add(5, 'minutes').unix(),
  });
  log.ex({ callOptions }).send();
  const estimateGas = await smartTradeRouter.estimateGas
    .handleOrder(order.number, callOptions, 1)
    .then((v) => v.toString());
  const gasLimit = new BN(estimateGas).multipliedBy(1.1).toFixed(0);
  const gasPrice = await provider.getGasPrice().then((v) => v.toString());
  const gasFee = new BN(gasLimit).multipliedBy(gasPrice).toFixed(0);
  const protocolFee = await smartTradeRouter.fee();
  const feeBalance = await balance
    .netBalanceOf(order.owner)
    .then((v: ethers.BigNumber) => v.toString());
  log.ex({ estimateGas, gasLimit, gasPrice, gasFee, protocolFee, feeBalance }).send();
  if (new BN(gasFee).plus(protocolFee).gt(feeBalance)) {
    return new Error('Insufficient funds to pay commission');
  }

  try {
    return smartTradeRouter.handleOrder(order.number, callOptions, gasFee, {
      gasLimit,
      gasPrice,
    });
  } catch (e) {
    return e instanceof Error ? e : new Error(`${e}`);
  } finally {
    await freeConsumer.unlock();
  }
}
