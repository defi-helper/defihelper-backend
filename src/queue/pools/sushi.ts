import { Process } from "@models/Queue/Entity";
import masterChief  from "./masterChief";

const masterChefAddress = "0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd";

const protocolName = 'SushiSwap';
const adapterName = 'sushiswap';
const protocolDescription = 'SushiSwap Farm';

const farmingAdapterName = 'masterChefV1';

export default async (process: Process) => {
    await masterChief(
        masterChefAddress,
        protocolName,
        protocolDescription,
        adapterName,
        farmingAdapterName,
        '1',
    )

    return process.done();
}