import container from "@container";

export default async (
    masterChefAddress: string,
    protocolName: string,
    protocolDescription: string,
    adapterName: string,
    farmingAdapterName: string,
    network: '1' | '56',
) => {
    let protocol = await container.model.protocolTable().where('name', protocolName).first();

    if (!protocol) {
        protocol = await container.model
            .protocolService()
            .create(
                adapterName,
                protocolName,
                protocolDescription,
                null,
                null,
                false,
            );
    }

    const blockchain = container.blockchain.ethereum;
    const provider = blockchain.byNetwork(network).provider();

    const masterChiefContract = container.blockchain.ethereum.contract(
        masterChefAddress,
        container.blockchain.ethereum.abi.masterChefV1ABI,
        provider,
    );

    const totalPools = await masterChiefContract.poolLength();
    const allPools = await Promise.all(new Array(totalPools.toNumber()).fill(1).map((_, i) => masterChiefContract.poolInfo(i)));

    const contract = await container.model.contractTable().where('protocol', protocol.id).select();

    const newPools = allPools.filter(pool => Number(pool.allocPoint.toString()) > 0 &&
        !contract.some(c => c.address.toLowerCase() === pool.lpToken.toLowerCase()));
    const removedPools = allPools.filter(pool => Number(pool.allocPoint.toString()) === 0 &&
        contract.some(c => c.address.toLowerCase() === pool.lpToken.toLowerCase()));

    await Promise.all(newPools.map(async pool => {
        if (!protocol) {
            return;
        }
        const pair = container.blockchain.ethereum.contract(
            pool.lpToken,
            container.blockchain.ethereum.abi.uniswapPairABI,
            provider,
        );

        const [token0, token1] = await Promise.all([
            pair.token0(),
            pair.token1(),
        ]);

        const [symbol0, symbol1] = await Promise.all([
            container.blockchain.ethereum.contract(
                token0,
                container.blockchain.ethereum.abi.uniswapPairABI,
                provider,
            ).symbol(),
            container.blockchain.ethereum.contract(
                token1,
                container.blockchain.ethereum.abi.uniswapPairABI,
                provider,
            ).symbol(),
        ]);


        return container.model
            .contractService()
            .create(
                protocol,
                'ethereum',
                network,
                pool.lpToken.toLowerCase(),
                null,
                farmingAdapterName,
                '',
                `${symbol0}/${symbol1} LP`,
                '',
                `${container.blockchain.ethereum.networks[network].walletExplorerURL.toString()}/${masterChefAddress}`,
                false,
            );
    }));

    await Promise.all(removedPools.map(async pool => {
        if (!protocol) {
            return;
        }

        await container.model.contractTable().update({
            hidden: true,
        }).where('adapter', protocol.id)
            .andWhere('address', pool.lpToken)
    }));
}