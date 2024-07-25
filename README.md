# DBOS Web3 Demo

This repo contains a sample DBOS application that listens for ERC20 Transfer events in order to maintain an off-chain
database of account balance information.

> Note, DBOS requires a PostgreSQL database. The DBOS application in the `off-chain` folder includes a script to 
> configure and start a Docker container running PostgreSQL. If you want to use your own PostgreSQL instance, 
> please see the [Configure Postgres Connection](https://docs.dbos.dev/getting-started/quickstart#2-configure-the-postgres-connection)
> section of the DBOS Quickstart for more details.

## Instructions

### Setup the chain

The `on-chain` folder contains a [Hardhat](https://hardhat.org/) smart contract project. 
The SampleToken is a simple ERC20 fungible token contract, using OpenZeppelin for most of the logic.

> Note, the on and off chain folders are separate due to a TypeScript version conflict between HardHat and DBOS. 

Run these steps to setup a Hardhat Network node and deploy the SampleToken contract to it.
The `off-chain` part of the demo will read information from this node.

1. From a terminal window in the `on-chain` folder, install dependencies via `npm install`
2. Then, execute `npm run start` to start the Hardhat Network Node
3. From a 2nd terminal window in the `on-chain` folder, build and deploy the contract by executing `npm run deploy`. Note, deploying the contract also executes several sample transfers for the DBOS application to observe.

### Run the DBOS application

The `off-chain` folder contains a [DBOS](https://dbos.dev) application that listens for ERC20 Transfer events
and updates the account balances in an off-chain PostgreSQL database. 

1. From a terminal window in the `off-chain` folder, install dependencies via `npm install`. 
   You may reuse the terminal window you used to deploy the SampleToken contract from the last section. Just make sure the terminal window running the Hardhat Network node remains intact.
2. Start the PostgreSQL Docker container by running `node ./start_postgres_docker.js`
3. Configure the user database in the PostgreSQL Docker container by executing `npx dbos migrate`
4. After the database is configured, execute `npm run build` to build the DBOS application
5. Finally, run `npx dbos start` to start the DBOS application.

When the DBOS application runs, the `logWorkflow` method will be invoked for every Transfer event raised by the SampleToken contract.
The `@Web3LogReceiver` decorator is used to receive events from the Hardhat Network node started we started earlier.
`@Web3LogReceiver` create a [viem](https://viem.sh) `publicClient` to connect to the specified chain and receive all the logs of the specified contract and event.
It also sets up an [event watcher](https://viem.sh/docs/actions/public/watchEvent) to receive any further events that may occur on the chain.

When the `@Web3LogReceiver` receives a log, it invokes the associated workflow using the log's transaction hash and log index to create an 
[idempotency key](https://docs.dbos.dev/tutorials/idempotency-tutorial).
Because the combination of transaction hash and log index is unique for a given chain, DBOS ensures every event is processed once and only once, 
regardless of how many times the event is received from the chain. You can see this by halting the running DBOS app using CTRL-C and re-running it.
THe first time you run the DBOS application, you get output that looks like this:

```sh
> npx dbos start
2024-07-25 00:08:44 [info]: Workflow executor initialized 
2024-07-25 00:08:44 [info]: HTTP endpoints supported: 
2024-07-25 00:08:44 [info]: Scheduled endpoints: 
2024-07-25 00:08:44 [info]: Web3 receiver endpoints: 
2024-07-25 00:08:44 [info]:     0x5fbdb2315678afecb367f032d93f642f64180aa3 -> Transfer(address,address,uint256) 
2024-07-25 00:08:44 [info]: DBOS Server is running at http://localhost:3000 
2024-07-25 00:08:44 [info]: DBOS Admin Server is running at http://localhost:3001 
2024-07-25 00:08:44 [info]: logWorkflow: 0xe4b94e426b68f9637c27cfa33fe8145c78b4581e1cc6ca2876b54dfe24e3577c-0 
2024-07-25 00:08:44 [info]: updateBalance: 0x0000000000000000000000000000000000000000 -> 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 : 1000000 
2024-07-25 00:08:44 [info]: logWorkflow: 0xd0b54ff53b8e11c3740a01af658f8c6fd82e191b9ff9e503b87850141ae4d0aa-0 
2024-07-25 00:08:44 [info]: logWorkflow: 0xe8bcdfb3212a7694d71904bb109324f09b3f5afee66cb41894fa46ab15107533-0 
2024-07-25 00:08:44 [info]: updateBalance: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 -> 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 : 100 
2024-07-25 00:08:44 [info]: logWorkflow: 0xd8729d5be154d574626756139af81db079ff500435848ee1e521578c9a600440-0 
2024-07-25 00:08:44 [info]: updateBalance: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 -> 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC : 100 
2024-07-25 00:08:44 [info]: logWorkflow: 0xd63a0a70c2713a4e81c9ed016991658d2faf56ff08c35fe237d65d7bda81471a-0 
2024-07-25 00:08:44 [info]: logTransaction: 1 0xe4b94e426b68f9637c27cfa33fe8145c78b4581e1cc6ca2876b54dfe24e3577c  
2024-07-25 00:08:44 [info]: updateBalance: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 -> 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 : 100 
2024-07-25 00:08:44 [info]: logTransaction: 2 0xd0b54ff53b8e11c3740a01af658f8c6fd82e191b9ff9e503b87850141ae4d0aa  
2024-07-25 00:08:44 [info]: logWorkflow: 0xb2347737db59651cc8b68953f53c078f6f0e4779865b1307d7d3ddadb5d7a38e-0 
2024-07-25 00:08:44 [info]: updateBalance: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 -> 0x90F79bf6EB2c4f870365E785982E1f101E93b906 : 100 
2024-07-25 00:08:44 [info]: updateBalance: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 -> 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc : 100 
2024-07-25 00:08:44 [info]: updateBalance: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 -> 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC : 100 
2024-07-25 00:08:44 [info]: updateBalance: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 -> 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 : 100 
2024-07-25 00:08:44 [info]: logTransaction: 5 0xd63a0a70c2713a4e81c9ed016991658d2faf56ff08c35fe237d65d7bda81471a  
2024-07-25 00:08:44 [info]: updateBalance: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 -> 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC : 100 
2024-07-25 00:08:44 [info]: updateBalance: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 -> 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 : 100 
2024-07-25 00:08:44 [info]: updateBalance: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 -> 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc : 100 
2024-07-25 00:08:44 [info]: updateBalance: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 -> 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC : 100 
2024-07-25 00:08:44 [info]: updateBalance: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 -> 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 : 100 
2024-07-25 00:08:44 [info]: logTransaction: 6 0xb2347737db59651cc8b68953f53c078f6f0e4779865b1307d7d3ddadb5d7a38e  
2024-07-25 00:08:44 [info]: updateBalance: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 -> 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC : 100 
2024-07-25 00:08:44 [info]: updateBalance: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 -> 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 : 100 
2024-07-25 00:08:44 [info]: logTransaction: 3 0xe8bcdfb3212a7694d71904bb109324f09b3f5afee66cb41894fa46ab15107533  
2024-07-25 00:08:44 [info]: updateBalance: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 -> 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 : 100 
2024-07-25 00:08:44 [info]: logTransaction: 4 0xd8729d5be154d574626756139af81db079ff500435848ee1e521578c9a600440  
2024-07-25 00:08:48 [info]: logWorkflow: 0xb2347737db59651cc8b68953f53c078f6f0e4779865b1307d7d3ddadb5d7a38e-0 
```

The second time you run the DBOS application, the output looks like this:

```sh
> npx dbos start
2024-07-25 00:18:44 [info]: Workflow executor initialized 
2024-07-25 00:18:44 [info]: HTTP endpoints supported: 
2024-07-25 00:18:44 [info]: Scheduled endpoints: 
2024-07-25 00:18:44 [info]: Web3 receiver endpoints: 
2024-07-25 00:18:44 [info]:     0x5fbdb2315678afecb367f032d93f642f64180aa3 -> Transfer(address,address,uint256) 
2024-07-25 00:18:44 [info]: DBOS Server is running at http://localhost:3000 
2024-07-25 00:18:44 [info]: DBOS Admin Server is running at http://localhost:3001 
2024-07-25 00:18:44 [info]: logWorkflow: 0xe4b94e426b68f9637c27cfa33fe8145c78b4581e1cc6ca2876b54dfe24e3577c-0 
2024-07-25 00:18:44 [info]: logWorkflow: 0xd0b54ff53b8e11c3740a01af658f8c6fd82e191b9ff9e503b87850141ae4d0aa-0 
2024-07-25 00:18:44 [info]: logWorkflow: 0xe8bcdfb3212a7694d71904bb109324f09b3f5afee66cb41894fa46ab15107533-0 
2024-07-25 00:18:44 [info]: logWorkflow: 0xd8729d5be154d574626756139af81db079ff500435848ee1e521578c9a600440-0 
2024-07-25 00:18:44 [info]: logWorkflow: 0xd63a0a70c2713a4e81c9ed016991658d2faf56ff08c35fe237d65d7bda81471a-0 
2024-07-25 00:18:44 [info]: logWorkflow: 0xb2347737db59651cc8b68953f53c078f6f0e4779865b1307d7d3ddadb5d7a38e-0 
```

You can see in the first DBOS application execution, we see DBOS info logs for `logWorkflow`, `updateBalance` and `logTransaction` methods.
The second time you run it, only `logWorkflow` gets called. 
This is DBOS [Reliable by Default](https://docs.dbos.dev/explanations/core-concepts#reliable-by-default) in action.
DBOS ensures every transaction log is processed once and only once by virtue of using the combined transaction hash and log index as the idempotency key.
When `logWorkflow` calls `updateBalance` and `logTransaction` on repeat executions, DBOS sees that those functions have already been executed.
The business logic is skipped and the function return value (if any) is retrieved from the database where it was stored the first time it ran.
So no matter how many times we re-process the same transaction log, we always have the correct account balance in the off-chain database.




