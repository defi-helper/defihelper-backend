import { Process } from "@models/Queue/Entity";
import container from "@container";
import dayjs from "dayjs";
import {Blockchain} from "@models/types";
import axios from "axios";
import { parse } from 'node-html-parser';
import * as net from "net";

export interface ContractRegisterParams {
    contract: string;
}

const getEthereumContractCreationBlock = async (network: string, address: string): Promise<number | undefined> => {
    const res = await axios.get(network === '1' ? `https://etherscan.io/address/${address}` : `https://bscscan.com/address/${address}`);
    const root = parse(res.data);
    const contractCreatorNode = root.querySelectorAll('div').find(div => div.text === '\nContractCreator:');
    if (!contractCreatorNode) {
        return;
    }

    const txHrefNode = contractCreatorNode.parentNode
        .querySelectorAll('a')
        .find(a => {
            const href = a.getAttribute('href');
            return href && href.indexOf('/tx') > -1;
        });

    if (!txHrefNode) {
        return;
    }

    const txHref = txHrefNode.getAttribute('href');

    if (!txHref) {
        return;
    }


    const txId = txHref.replace('/tx/', '');

    try {
        const txInfo = await container.scanner().txReceipt(network, txId);
        return  txInfo.blockNumber;
    } catch {
        return undefined;
    }
}

export const getContractCreationBlock = async (blockchain: Blockchain, network: string, address: string): Promise<number | undefined> => {
    if (blockchain === 'ethereum') {
        return getEthereumContractCreationBlock(network,address);
    }
    
    return undefined
}

export default async (process: Process) => {
    const registerParams = process.task.params as ContractRegisterParams;

    const contract = await container.model.contractTable().where('id', registerParams.contract).first();

    if (!contract) {
        throw new Error("Contract is not found");
    }

    const startHeight = contract.deployBlockNumber ? parseInt(contract.deployBlockNumber, 10) :
        (await getContractCreationBlock(contract.blockchain, contract.network, contract.address));

    const contractFromScanner = await container.scanner().findContract(contract.network, contract.address);
    if (!contractFromScanner || !contractFromScanner.abi) {
        await container.scanner().registerContract(
            contract.network,
            contract.address,
            contract.name,
            startHeight,
        );
        return process.later(dayjs().add(1, "minutes").toDate());
    }

    const methods: string[] = contractFromScanner.abi
        .filter(({ type }: any) => type === "event")
        .map(({ name }: any) => name);

    for (const method of methods) {
        await container.scanner().registerListener(contractFromScanner.id, method, startHeight);
    }

    return process.done();
};
