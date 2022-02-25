import { Factory } from '@services/Container';
import { v4 as uuid } from 'uuid';
import { User } from '@models/User/Entity';
import { Status, Proposal, ProposalTable, VoteTable, TagTable, Tag, ProposalTag } from './Entity';

export class ProposalService {
  constructor(
    readonly proposalTable: Factory<ProposalTable>,
    readonly voteTable: Factory<VoteTable>,
    readonly tagTable: Factory<TagTable>,
  ) {}

  async create(title: string, description: string, author: User) {
    const created = {
      id: uuid(),
      title,
      description,
      author: author.id,
      status: Status.Open,
      plannedAt: null,
      releasedAt: null,
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

  async tag(proposal: Proposal, user: User, tag: Tag) {
    const duplicate = await this.tagTable()
      .where('proposal', proposal.id)
      .andWhere('user', user.id)
      .andWhere('tag', tag)
      .first();
    if (duplicate) return duplicate;

    const created: ProposalTag = {
      id: uuid(),
      proposal: proposal.id,
      user: user.id,
      tag,
      createdAt: new Date(),
    };
    await this.tagTable().insert(created);

    return created;
  }

  async untag(proposal: Proposal, user: User, tag: Tag) {
    const proposalTag = await this.tagTable()
      .where('proposal', proposal.id)
      .andWhere('user', user.id)
      .andWhere('tag', tag)
      .first();
    if (!proposalTag) return;

    await this.tagTable().where({ id: proposalTag.id }).delete();
  }
}
