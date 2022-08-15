import container from '@container';
import { isKey } from '@services/types';
import contracts from '@defihelper/networks/contracts.json';
import { useEthereumFreeConsumer } from '@services/Blockchain/Consumer';
import { LogJsonMessage } from '@services/Log';
import { ethers } from 'ethers';
import { BigNumber as BN } from 'bignumber.js';
import { Order, SwapCallData } from '../Entity';
import UniswapRouterABI from '../data/uniswapRouterABI.json';
import SmartTradeRouterABI from '../data/smartTradeRouterABI.json';

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
      expectedAmountOut: order.callData.amountOut,
      actualAmountOut: actualAmountOut.toString(10),
    })
    .send();
  if (
    (order.callData.direction === 'gt' && actualAmountOut.lt(order.callData.amountOut)) ||
    (order.callData.direction === 'lt' && actualAmountOut.gt(order.callData.amountOut))
  ) {
    return null;
  }
  if (actualAmountOut.lt(order.callData.amountOutMin)) {
    return null;
  }

  const freeConsumer = await useEthereumFreeConsumer(order.network);
  log.ex({ consumer: freeConsumer?.consumer.address }).send();
  if (freeConsumer === null) return new Error('Not free consumer');

  const networkContracts = contracts[order.network] as { [name: string]: { address: string } };
  const smartTradeRouter = container.blockchain.ethereum.contract(
    networkContracts.SmartTradeRouter.address,
    SmartTradeRouterABI,
    freeConsumer.consumer,
  );

  try {
    const estimateGas = await smartTradeRouter.estimateGas
      .handleOrder(order.number, 1)
      .then((v) => v.toString());
    const gasLimit = new BN(estimateGas).multipliedBy(1.1).toFixed(0);
    const gasPrice = await provider.getGasPrice().then((v) => v.toString());
    const gasFee = new BN(gasLimit).multipliedBy(gasPrice).toFixed(0);
    log.ex({ estimateGas, gasLimit, gasPrice, gasFee }).send();
    return smartTradeRouter.handleOrder(order.number, gasFee, {
      gasLimit,
      gasPrice,
    });
  } catch (e) {
    return e instanceof Error ? e : new Error(`${e}`);
  } finally {
    await freeConsumer.unlock();
  }
}
