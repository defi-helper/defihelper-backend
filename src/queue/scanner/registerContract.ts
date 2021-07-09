import { Process } from "@models/Queue/Entity";
import container from "@container";
import dayjs from "dayjs";

export interface ContractRegisterParams {
    contract: string;
}

export default async (process: Process) => {
    const registerParams = process.task.params as ContractRegisterParams;

    const contract = await container.model.contractTable().where('id', registerParams.contract).first();

    if (!contract) {
        throw new Error("Contract is not found");
    }

    const contractFromScanner = await container.scanner().findContract(contract.network, contract.address);
    if (!contractFromScanner || !contractFromScanner.abi) {
        await container.scanner().registerContract(
            contract.network,
            contract.address,
            contract.name,
            contract.deployBlockNumber ? parseInt(contract.deployBlockNumber, 10) : undefined,
        );
        return process.later(dayjs().add(1, "minutes").toDate());
    }

    const methods: string[] = contractFromScanner.abi
        .filter(({ type }: any) => type === "event")
        .map(({ name }: any) => name);

    for (const method of methods) {
        await container.scanner().registerListener(contractFromScanner.id, method, contractFromScanner.startHeight);
    }

    return process.done();
};
