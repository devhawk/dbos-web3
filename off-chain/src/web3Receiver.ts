import {
    Error as DBOSError,
    DBOSEventReceiver,
    DBOSExecutorContext,
    WorkflowContext,
    WorkflowFunction,
    associateClassWithEventReceiver,
    associateMethodWithEventReceiver,
} from '@dbos-inc/dbos-sdk';
import {
    createPublicClient,
    http,
    parseAbiItem,
    webSocket
} from 'viem'
import type {
    AbiEvent,
    Address,
    Chain,
    HttpTransportConfig,
    Log,
    WebSocketTransportConfig,
} from 'viem'
import { formatAbiItem } from 'viem/utils';

export interface Web3ClientConfig {
    chain: Chain,
    transport: "http" | "websocket",
    url?: string,
    httpConfig?: HttpTransportConfig,
    wsConfig?: WebSocketTransportConfig,
}

function getClient(config: Web3ClientConfig) {
    return createPublicClient({
        chain: config.chain,
        transport: getTransport(config),
    })

    function getTransport(config: Web3ClientConfig) {
        switch (config.transport) {
            case 'http': return http(config.url, config.httpConfig);
            case "websocket": return webSocket(config.url, config.wsConfig);
            default:
                const _: never = config.transport;
                throw new Error(`Unexpected transport: ${config.transport}`);
        }
    }
}

interface Web3ReceiverConfig extends Web3ClientConfig{
    address?: Address | Address[];
    event?: AbiEvent | string;
}

interface Web3ReceiverClassConfig {
    config?: Web3ReceiverConfig;
}

interface Web3ReceiverMethodConfig {
    config?: Web3ReceiverConfig;
}

function parseConfigEvent(methodConfig: Web3ReceiverConfig | undefined, classConfig: Web3ReceiverConfig | undefined) {
    const event = methodConfig?.event ?? classConfig?.event;
    return typeof event === 'string' ? parseAbiItem(event) as AbiEvent : event;
}

function formatConfigEvent(methodConfig: Web3ReceiverConfig | undefined, classConfig: Web3ReceiverConfig | undefined) {
    const event = methodConfig?.event ?? classConfig?.event;
    return typeof event === 'object' ? formatAbiItem(event) : event;
}

export class Web3Receiver implements DBOSEventReceiver {
    executor?: DBOSExecutorContext;
    listeners: (() => void)[] = [];

    static async logWorkflow(executor: DBOSExecutorContext, logs: readonly Log[], $function: Function | undefined) {
        for (const log of logs) {
            const workflowUUID = `${log.transactionHash}-${log.logIndex}`;
            await executor.workflow($function as WorkflowFunction<[Log], unknown>, { workflowUUID }, log);
        }
    }

    async initialize(executor: DBOSExecutorContext): Promise<void> {
        this.executor = executor;
        const regops = this.executor.getRegistrationsFor(this);

        for (const op of regops) {
            const classConfig = op.classConfig as Web3ReceiverClassConfig;
            const methodConfig = op.methodConfig as Web3ReceiverMethodConfig;
            const method = op.methodReg;
            const cname = method.className;
            const mname = method.name;
            if (!method.workflowConfig) {
                throw new DBOSError.DBOSError(`Error registering method ${cname}.${mname}: An Web3Receiver decorator can only be assigned to a workflow!`)
            }
            
            const chain = methodConfig.config?.chain ?? classConfig.config?.chain;
            if (!chain) { 
                throw new DBOSError.DBOSError(`Error registering method ${cname}.${mname}: chain is required!`) 
            }
            const transport = methodConfig.config?.transport ?? classConfig.config?.transport;
            if (!transport) {
                throw new DBOSError.DBOSError(`Error registering method ${cname}.${mname}: transport is required!`)
            }
            const client = getClient({ 
                chain, 
                transport, 
                url: methodConfig.config?.url ?? classConfig.config?.url, 
                httpConfig: methodConfig.config?.httpConfig ?? classConfig.config?.httpConfig, 
                wsConfig: methodConfig.config?.wsConfig ?? classConfig.config?.wsConfig 
            });

            const address = methodConfig.config?.address ?? classConfig.config?.address;
            const event = parseConfigEvent(methodConfig.config, classConfig.config);

            this.listeners.push(client.watchEvent({
                address,
                event,
                onLogs: logs => Web3Receiver.logWorkflow(executor, logs, method.registeredFunction),
            }));

            setImmediate(async () => {
                const logs = await client.getLogs({
                    address,
                    event,
                    fromBlock: 0n,
                });
                await Web3Receiver.logWorkflow(executor, logs, method.registeredFunction)
            });
        }
    }

    async destroy(): Promise<void> {
        this.listeners.forEach(listener => listener());
        this.listeners.length = 0;
    }

    logRegisteredEndpoints(): void {
        if (!this.executor) return;
        const logger = this.executor.logger;
        logger.info("Viem receiver endpoints:");
        const regops = this.executor.getRegistrationsFor(this);
        regops.forEach((registeredOperation) => {
            const classConfig = registeredOperation.classConfig as Web3ReceiverClassConfig;
            const methodConfig = registeredOperation.methodConfig as Web3ReceiverMethodConfig;

            const address = methodConfig.config?.address ?? classConfig.config?.address;
            const event = formatConfigEvent(methodConfig.config, classConfig.config);
            logger.info(`    ${address} -> ${event}`);
        });
    }
}

let web3Receiver: Web3Receiver | undefined = undefined;

export function Web3Configure(config: Web3ReceiverConfig) {
    function clsdec<T extends { new(...args: unknown[]): object }>(ctor: T) {
        if (!web3Receiver) web3Receiver = new Web3Receiver();
        const erInfo = associateClassWithEventReceiver(web3Receiver, ctor) as Web3ReceiverClassConfig;
        erInfo.config = config;
    }
    return clsdec;
}

export function Web3LogReceiver(config?: Web3ReceiverConfig) {
    function mtddec<This, Ctx extends WorkflowContext, Return>(
        target: object,
        propertyKey: string,
        inDescriptor: TypedPropertyDescriptor<(this: This, ctx: Ctx, ...args: [Log]) => Promise<Return>>
    ) {
        if (!web3Receiver) web3Receiver = new Web3Receiver();

        const { descriptor, receiverInfo } = associateMethodWithEventReceiver(web3Receiver, target, propertyKey, inDescriptor);

        const mRegistration = receiverInfo as Web3ReceiverMethodConfig;
        mRegistration.config = config;

        return descriptor;
    }
    return mtddec;
}