import { Process } from "@models/Queue/Entity";
import masterChief  from "./masterChief";

const masterChefAddress = "0x73feaa1ee314f8c655e354234017be2193c9e24e";

const protocolName = 'PancakeSwap';
const adapterName = 'pancakeswap';
const protocolDescription = 'PancakeSwap Farm';

const farmingAdapterName = 'masterChef';

export default async (process: Process) => {
    await masterChief(
        masterChefAddress,
        protocolName,
        protocolDescription,
        adapterName,
        farmingAdapterName,
        '56',
    )

    return process.done();
}