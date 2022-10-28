import container from '@container';
import { useEthereumFreeConsumer } from '@services/Blockchain/Consumer';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import { LogJsonMessage } from '@services/Log';
import { abi as BalanceABI } from '@defihelper/networks/abi/Balance.json';
import { abi as SmartTradeRouterABI } from '@defihelper/networks/abi/SmartTradeRouter.json';
import { abi as SmartTradeSwapHandlerABI } from '@defihelper/networks/abi/SmartTradeSwapHandler.json';
import { ethers } from 'ethers';
import dayjs from 'dayjs';
import { BigNumber as BN } from 'bignumber.js';
import { Order, SwapCallData } from '../Entity';
import UniswapRouterABI from '../data/uniswapRouterABI.json';

async function activateOrder(order: Order<SwapCallData>, actualAmountout: string) {
  if (order.active) return order;

  const { amountOut, direction } = order.callData.activate ?? {};
  if (
    direction === undefined ||
    amountOut === undefined ||
    (direction === 'lt' && new BN(actualAmountout).lt(amountOut)) ||
    (direction === 'gt' && new BN(actualAmountout).gt(amountOut))
  ) {
    return container.model.smartTradeService().updateOrder({ ...order, active: true });
  }

  return order;
}

export default async function (
  order: Order<SwapCallData>,
): Promise<ethers.ContractTransaction | Error | null> {
  const log = LogJsonMessage.debug({ source: 'smartTradeSwapHandler', orderId: order.id });
  const ownerWallet = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletTableName}.id`,
      `${walletBlockchainTableName}.id`,
    )
    .where(`${walletTableName}.id`, order.owner)
    .first();
  if (!ownerWallet) {
    return new Error('Owner wallet not found');
  }
  const network = container.blockchain.ethereum.byNetwork(ownerWallet.network);
  const contracts = network.dfhContracts();
  if (contracts === null) {
    throw new Error('Contracts not deployed to target network');
  }
  const balanceAddress = contracts.BalanceUpgradable?.address ?? contracts.Balance?.address;
  if (balanceAddress === undefined) {
    throw new Error('Balance contract not deployed on target network');
  }
  const smartTradeRouterAddress = contracts.SmartTradeRouter?.address;
  if (smartTradeRouterAddress === undefined) {
    return new Error('Smart trade router not deployed to target network');
  }
  const smartTradeSwapHandlerAddress = contracts.SmartTradeSwapHandler?.address;
  if (smartTradeSwapHandlerAddress === undefined) {
    return new Error('Smart trade swap handler not deployed to target network');
  }
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
      activate: JSON.stringify(order.callData.activate),
      actualAmountOut: actualAmountOut.toString(10),
    })
    .send();

  const { active } = await activateOrder(order, actualAmountOut);
  log.ex({ active }).send();
  if (!active) {
    return null;
  }

  const routes = order.callData.routes.map((route) => {
    if (route === null) return route;
    if (route.direction === 'lt') {
      if (route.moving !== null && actualAmountOut.minus(route.amountOut).gt(route.moving)) {
        const amountOut = actualAmountOut.minus(route.moving);
        return {
          ...route,
          amountOut: amountOut.toFixed(0),
          amountOutMin: amountOut.multipliedBy(new BN(1).minus(route.slippage)).toFixed(0),
        };
      }
    }

    return route;
  });
  await container.model.smartTradeService().updateOrder({
    ...order,
    active,
    callData: {
      ...order.callData,
      routes,
    },
  });

  const routeIndex = routes.reduce<number | null>((prev, route, index) => {
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

  const freeConsumer = await useEthereumFreeConsumer(ownerWallet.network);
  log.ex({ consumer: freeConsumer?.consumer.address }).send();
  if (freeConsumer === null) return new Error('Not free consumer');

  try {
    const balance = container.blockchain.ethereum.contract(
      balanceAddress,
      BalanceABI,
      freeConsumer.consumer,
    );
    const smartTradeRouter = container.blockchain.ethereum.contract(
      smartTradeRouterAddress,
      SmartTradeRouterABI,
      freeConsumer.consumer,
    );
    const smartTradeHandler = container.blockchain.ethereum.contract(
      smartTradeSwapHandlerAddress,
      SmartTradeSwapHandlerABI,
      freeConsumer.consumer,
    );

    const routerBalance: string = await smartTradeRouter
      .balanceOf(ownerWallet.address, order.callData.path[0])
      .then((v: ethers.BigNumber) => v.toString());
    log.ex({ routerBalance }).send();
    if (new BN(order.callData.amountIn).gt(routerBalance)) {
      return new Error('Insufficient funds to swap');
    }

    const callOptions = await smartTradeHandler.callOptionsEncode({
      route: routeIndex,
      deadline: dayjs().add(order.callData.deadline, 'seconds').unix(),
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
      .netBalanceOf(ownerWallet.address)
      .then((v: ethers.BigNumber) => v.toString());
    log.ex({ estimateGas, gasLimit, gasPrice, gasFee, protocolFee, feeBalance }).send();
    if (new BN(gasFee).plus(protocolFee).gt(feeBalance)) {
      return new Error('Insufficient funds to pay commission');
    }

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
