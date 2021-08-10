import { tableFactory as createTableFactory } from '@services/Database';

export enum ProposalState {
  Pending = 'pending',
  Active = 'active',
  Canceled = 'canceled',
  Defeated = 'defeated',
  Succeeded = 'succeeded',
  Queued = 'queued',
  Expired = 'expired',
  Executed = 'executed',
}

export interface ProposalCallData {
  targets: string[];
  values: string[];
  signatures: string[];
  args: string[][];
}

export interface Proposal {
  network: string;
  contract: string;
  id: number;
  proposer: string;
  eta: number;
  calldata: ProposalCallData;
  startBlock: number;
  endBlock: number;
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  canceled: boolean;
  executed: boolean;
  state: ProposalState;
  description: string;
  createdAt: Date;
}

export const proposalTableName = 'governance_proposal';

export const proposalTableFactory = createTableFactory<Proposal>(proposalTableName);

export type ProposalTable = ReturnType<ReturnType<typeof proposalTableFactory>>;

export enum ReceiptSupport {
  Against = 'against',
  For = 'for',
  Abstain = 'Abstain',
}

export interface Receipt {
  network: string;
  contract: string;
  proposal: number;
  address: string;
  hasVoted: boolean;
  support: ReceiptSupport;
  votes: string;
  reason: string;
  createdAt: Date;
}

export const receiptTableName = 'governance_receipt';

export const receiptTableFactory = createTableFactory<Receipt>(receiptTableName);

export type ReceiptTable = ReturnType<ReturnType<typeof receiptTableFactory>>;
