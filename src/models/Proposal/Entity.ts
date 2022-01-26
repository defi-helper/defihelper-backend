import { tableFactoryLegacy } from '@services/Database';

export enum Status {
  Open = 'open',
  InProcess = 'in_process',
  Executed = 'executed',
  Defeated = 'defeated',
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  author: string | null;
  status: Status;
  plannedAt: Date | null;
  releasedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
}

export const proposalTableName = 'proposal';

export const proposalTableFactory = tableFactoryLegacy<Proposal>(proposalTableName);

export type ProposalTable = ReturnType<ReturnType<typeof proposalTableFactory>>;

export interface Vote {
  id: string;
  proposal: string;
  user: string;
  updatedAt: Date;
  createdAt: Date;
}

export const voteTableName = 'proposal_vote';

export const voteTableFactory = tableFactoryLegacy<Vote>(voteTableName);

export type VoteTable = ReturnType<ReturnType<typeof voteTableFactory>>;
