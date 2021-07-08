import { Process } from "@models/Queue/Entity";
import container from "@container";

export interface ScannerSubscriptionParams {
    network: string;
    address: string;
    event: string;
    webHookId: string;
}

export default async (process: Process) => {
    const subscriptionParams = process.task.params as ScannerSubscriptionParams;

    const callBackUrl = `http://${container.parent.api.internalUrl}:${container.parent.api.port}/events_api/${
        subscriptionParams.webHookId}`

    await container.scanner().registerCallback(
        parseInt(subscriptionParams.network, 10),
        subscriptionParams.address,
        subscriptionParams.event,
        callBackUrl,
    );

    return process.done();
};
