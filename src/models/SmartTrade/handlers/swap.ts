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
      routes: JSON.stringify(order.callData.routes),
      actualAmountOut: actualAmountOut.toString(10),
    })
    .send();

  // Update routes
  const routes = await Promise.all(
    order.callData.routes.map(async (route, index) => {
      if (route === null) return route;

      const update = {
        amountOut: route.amountOut,
        amountOutMin: route.amountOutMin,
        activated: route.activation?.activated ?? null,
        timeoutAt: route.timeout?.enterAt ?? null,
        timeoutActivated: route.timeout?.activated ?? null,
      };
      if (route.moving !== null && actualAmountOut.minus(route.amountOut).abs().gt(route.moving)) {
        const amountOut =
          route.direction === 'gt'
            ? actualAmountOut.plus(route.moving)
            : actualAmountOut.minus(route.moving);
        update.amountOut = amountOut.toFixed(0);
        update.amountOutMin = amountOut.multipliedBy(new BN(1).minus(route.slippage)).toFixed(0);
      }
      if (route.activation && route.activation.activated === false) {
        const { direction, amountOut } = route.activation;
        if (
          (direction === 'lt' && actualAmountOut.lte(amountOut)) ||
          (direction === 'gt' && actualAmountOut.gte(amountOut))
        ) {
          update.activated = true;
        }
      }
      if (route.timeout) {
        const isEnter =
          (route.direction === 'lt' && actualAmountOut.lte(route.amountOut)) ||
          (route.direction === 'gt' && actualAmountOut.gte(route.amountOut));
        if (route.timeout.enterAt) {
          if (isEnter) {
            if (
              dayjs
                .unix(route.timeout.enterAt)
                .add(route.timeout.duration, 'seconds')
                .isBefore(new Date())
            ) {
              update.timeoutActivated = true;
            }
          } else {
            update.timeoutAt = null;
            update.timeoutActivated = false;
          }
        } else if (isEnter) {
          update.timeoutAt = dayjs().unix();
          await container.model.queueService().push(
            'smartTradeTimeout',
            { order: order.id, route: index, enterAt: update.timeoutAt },
            {
              startAt: dayjs.unix(update.timeoutAt).add(route.timeout.duration, 'seconds').toDate(),
              priority: 7,
            },
          );
        }
      }

      return {
        ...route,
        amountOut: update.amountOut,
        amountOutMin: update.amountOutMin,
        activation: route.activation
          ? {
              ...route.activation,
              activated: update.activated,
            }
          : null,
        timeout: route.timeout
          ? {
              ...route.timeout,
              enterAt: update.timeoutAt,
              activated: update.timeoutActivated,
            }
          : null,
      };
    }),
  );
  log.ex({ routes: JSON.stringify(routes) }).send();
  await container.model.smartTradeService().updateOrder(order, {
    callData: {
      ...order.callData,
      routes,
    },
  });

  // Find actual route
  const routeIndex = routes.reduce<number | null>((prev, route, index) => {
    if (prev !== null || route === null) return prev;
    if (route.activation?.activated === false || route.timeout?.activated === false) {
      return prev;
    }
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
  const currentRoute = routes[routeIndex];
  if (currentRoute === null) return null;

  // Execute transaction
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
      .balanceOf(order.number, order.callData.path[0])
      .then((v: ethers.BigNumber) => v.toString());
    log.ex({ routerBalance }).send();
    if (new BN(order.callData.amountIn).gt(routerBalance)) {
      return new Error('Insufficient funds to swap');
    }

    const callOptions = await smartTradeHandler.callOptionsEncode({
      route: routeIndex,
      amountOutMin: currentRoute.amountOutMin,
      deadline: dayjs().add(order.callData.deadline, 'seconds').unix(),
      emergency: false,
    });
    log.ex({ callOptions }).send();
    const estimateGas = await smartTradeRouter.estimateGas
      .handleOrder(order.number, callOptions, 1)
      .then((v: ethers.BigNumber) => v.toString());
    const gasLimit = new BN(estimateGas).multipliedBy(1.1).toFixed(0);
    const gasPrice = await provider.getGasPrice().then((v) => v.toString());
    const gasFee = new BN(gasLimit).multipliedBy(gasPrice).toFixed(0);
    const protocolFee = await smartTradeRouter.fee().then((v: ethers.BigNumber) => v.toString());
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
