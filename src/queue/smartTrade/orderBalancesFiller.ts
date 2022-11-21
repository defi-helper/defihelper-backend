import BN from 'bignumber.js';
import container from '@container';
import { Process } from '@models/Queue/Entity';
import { HandlerType, OrderStatus } from '@models/SmartTrade/Entity';
import { TokenCreatedBy } from '@models/Token/Entity';
import ethersMulticall from '@defihelper/ethers-multicall';
import contracts from '@defihelper/networks/contracts.json';
import { abi as RouterABI } from '@defihelper/networks/abi/SmartTradeRouter.json';
import { isKey } from '@services/types';

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const order = await container.model.smartTradeOrderTable().where('id', id).first();
  if (!order) throw new Error('Order not found');
  if (order.type !== HandlerType.SwapHandler) {
    throw new Error('Only "swap handler" supported');
  }

  const ownerWallet = await container.model
    .walletBlockchainTable()
    .where('id', order.owner)
    .first();
  if (!ownerWallet) {
    throw new Error('Owner wallet not found');
  }
  if (ownerWallet.blockchain !== 'ethereum') {
    throw new Error('Invalid blockchain');
  }
  if (!isKey(contracts, ownerWallet.network)) {
    throw new Error('Contracts not deployed to target network');
  }

  const { path } = order.callData;
  const tokens = await Promise.all(
    path.map((address) =>
      container.model
        .tokenService()
        .getOrCreate(
          ownerWallet.blockchain,
          ownerWallet.network,
          address,
          TokenCreatedBy.SmartTrade,
        ),
    ),
  );

  const provider = container.blockchain.ethereum.byNetwork(ownerWallet.network).provider();
  const multicall = new ethersMulticall.Provider(provider);
  await multicall.init();
  const networkContracts = contracts[ownerWallet.network] as {
    [name: string]: { address: string };
  };
  const smartTradeRouter = new ethersMulticall.Contract(
    networkContracts.SmartTradeRouter.address,
    RouterABI,
  );

  const balances = await multicall.all(
    tokens.map((token) => smartTradeRouter.balanceOf(order.number, token.address)),
  );
  const balancesMap = tokens.reduce<Record<string, { balance: string; address: string }>>(
    (prev, token, i) => ({
      ...prev,
      [token.id]: {
        balance: new BN(balances[i]?.toString() ?? '0').div(`1e${token.decimals}`).toString(10),
        address: token.address,
      },
    }),
    {},
  );

  const outTokenBalance =
    Object.values(balancesMap).find(
      ({ address }) => address.toLowerCase() === path[path.length - 1].toLowerCase(),
    )?.balance ?? '0';

  const updated = {
    ...order,
    callData: {
      ...order.callData,
      swapPrice:
        order.status === OrderStatus.Succeeded
          ? new BN(outTokenBalance)
              .div(new BN(order.callData.amountIn).div(`1e${order.callData.tokenInDecimals}`))
              .toString(10)
          : null,
    },
    balances: Object.entries(balancesMap).reduce(
      (res, [tokenId, { balance: b }]) => ({ ...res, [tokenId]: b }),
      {},
    ),
  };
  await container.model
    .smartTradeOrderTable()
    .update({
      callData: order.callData,
      balances: order.balances,
    })
    .where('id', order.id);
  container.model.smartTradeService().onOrderUpdated.emit(updated);

  return process.done();
};
