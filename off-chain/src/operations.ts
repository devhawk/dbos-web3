import { TransactionContext, Transaction, GetApi, ArgSource, ArgSources, DBOSInitializer, InitContext, WorkflowContext, Workflow } from '@dbos-inc/dbos-sdk';
import { Knex } from 'knex';
import { Web3LogReceiver, Web3Receiver } from './web3Receiver';
import { ContractEventArgsFromTopics, decodeEventLog, DecodeEventLogReturnType, erc20Abi, Log } from 'viem';
import { hardhat } from 'viem/chains'

export interface Account {
  address: string;
  balance: bigint;
}

export interface Transfer {
  id: number,
  from: string,
  to: string,
  amount: bigint,
  block_hash: string | null,
  block_number: bigint | null,
  transaction_hash: string | null,
}

type TransferEventArgs = ContractEventArgsFromTopics<typeof erc20Abi, "Transfer">;

export class TokenWatcher {

  // Create a workflow that listens for SampleToken Transfer events
  // Note, an improved version of Web3LogReceiver would allow these fields to be retrieved 
  //       from DBOS Configuration (https://docs.dbos.dev/api-reference/configuration)
  //       instead of being hard coded.
  @Web3LogReceiver({
    chain: hardhat,
    transport: "http",
    address: '0x5fbdb2315678afecb367f032d93f642f64180aa3',
    event: erc20Abi.find(e => e.name === 'Transfer'),
  })
  @Workflow()
  static async logWorkflow(ctx: WorkflowContext, log: Log) {
    ctx.logger.info(`logWorkflow: ${ctx.workflowUUID}`);

    // Web3LogReceiver calls the workflow method with the raw log object, so we need to decode it 
    const event = decodeEventLog({ ...log, abi: erc20Abi, eventName: 'Transfer' });

    // update the database with the transfer event args
    await ctx.invoke(TokenWatcher).updateBalance(event.args);
    await ctx.invoke(TokenWatcher).logTransaction(log, event.args);
  }

  // this transaction method creates a local copy of SampleToken account balances in the off-chain database
  @Transaction()
  static async updateBalance(ctx: TransactionContext<Knex>, args: TransferEventArgs) {
    ctx.logger.info(`updateBalance: ${args.from} -> ${args.to} : ${args.value}`);

    const from = await ctx.client<Account>('accounts').insert({
      address: args.from,
      balance: -1n * args.value,
    }).onConflict('address').merge({
      balance: ctx.client.raw('accounts.balance - ?', [args.value]),
    }).returning('balance');

    const to = await ctx.client<Account>('accounts').insert({
      address: args.to,
      balance: args.value,
    }).onConflict('address').merge({
      balance: ctx.client.raw('accounts.balance + ?', [args.value]),
    }).returning('balance');

    return {
      from: from[0].balance,
      to: to[0].balance,
    };
  }

  // this transaction method merely logs the transfer event to the database
  @Transaction()
  static async logTransaction(ctx: TransactionContext<Knex>, log: Log, args: TransferEventArgs) {
    ctx.logger.info(`logTransaction: ${log.blockNumber} ${log.transactionHash} `);
    await ctx.client<Transfer>('transfers').insert({
      from: args.from,
      to: args.to,
      amount: args.value,
      block_hash: log.blockHash,
      block_number: log.blockNumber,
      transaction_hash: log.transactionHash,
    });
  }
}
