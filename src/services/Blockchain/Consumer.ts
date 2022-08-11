import container from '@container';
import { ethers } from 'ethers';

export const useEthereumFreeConsumer = async (network: string) => {
  const semafor = container.semafor();
  const consumers = container.blockchain.ethereum.byNetwork(network).consumers();
  const consumer = await consumers.reduce<Promise<ethers.Wallet | null>>(
    async (prev, current) =>
      prev.then(
        (wallet) =>
          wallet ||
          semafor
            .lock(`defihelper:automate:consumer:ethereum:${network}:${current.address}`)
            .then(() => current)
            .catch(() => null),
      ),
    Promise.resolve(null),
  );

  return consumer
    ? {
        consumer,
        unlock: () =>
          semafor.unlock(`defihelper:automate:consumer:ethereum:${network}:${consumer.address}`),
      }
    : null;
};

export const useWavesFreeConsumer = (network: string) => {
  const consumers = container.blockchain.waves.byNetwork(network).consumers();
  return consumers[Math.floor(Math.random() * consumers.length)] ?? null;
};
