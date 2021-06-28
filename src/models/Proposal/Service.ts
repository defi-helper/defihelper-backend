import { Factory } from '@services/Container';
import { v4 as uuid } from 'uuid';
import { User } from '@models/User/Entity';
import { Status, Proposal, ProposalTable, Vote, VoteTable } from './Entity';

export class ProposalService {
  constructor(
    readonly proposalTable: Factory<ProposalTable> = proposalTable,
    readonly voteTable: Factory<VoteTable> = voteTable,
  ) {}

  async create(title: string, description: string, author: User) {
    const created = {
      id: uuid(),
      title,
      description,
      author: author.id,
      status: Status.Open,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.proposalTable().insert(created);

    return created;
  }

  async update(proposal: Proposal) {
    const updated = {
      ...proposal,
      updatedAt: new Date(),
    };
    await this.proposalTable().where({ id: proposal.id }).update(updated);

    return updated;
  }

  async delete(proposal: Proposal) {
    await this.proposalTable().where({ id: proposal.id }).delete();
  }

  async vote(proposal: Proposal, user: User) {
    const duplicate = await this.voteTable()
      .where('proposal', proposal.id)
      .andWhere('user', user.id)
      .first();
    if (duplicate) return duplicate;

    const created = {
      id: uuid(),
      proposal: proposal.id,
      user: user.id,
      updatedAt: new Date(),
      createdAt: new Date(),
    };
    await this.voteTable().insert(created);

    return created;
  }

  async unvote(proposal: Proposal, user: User) {
    const vote = await this.voteTable()
      .where('proposal', proposal.id)
      .andWhere('user', user.id)
      .first();
    if (!vote) return;

    await this.voteTable().where({ id: vote.id }).delete();
  }
}
