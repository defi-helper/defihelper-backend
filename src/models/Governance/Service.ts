import BN from 'bignumber.js';
import container from '@container';
import { ethers } from 'ethers';
import { Factory } from '@services/Container';
import dayjs from 'dayjs';
import { Semafor } from '@services/Cache';
import {
  ProposalTable,
  Proposal,
  ReceiptTable,
  Receipt,
  ProposalState,
  ReceiptSupport,
} from './Entity';

export class GovernanceService {
  constructor(
    readonly proposalTable: Factory<ProposalTable>,
    readonly receiptTable: Factory<ReceiptTable>,
    readonly semafor: Factory<Semafor>,
  ) {}

  static async latestProposalId(network: string | number, governorBravoAddress: string) {
    const blockchainContainer = container.blockchain.ethereum;
    const provider = blockchainContainer.byNetwork(network).provider();
    const governorBravo = blockchainContainer.contract(
      governorBravoAddress,
      blockchainContainer.abi.governorBravoABI,
      provider,
    );

    return governorBravo.proposalCount().then((v: ethers.BigNumber) => v.toNumber());
  }

  static async votes(network: string | number, governanceTokenAddress: string, wallet: string) {
    const blockchainContainer = container.blockchain.ethereum;
    const provider = blockchainContainer.byNetwork(network).provider();
    const governanceToken = blockchainContainer.contract(
      governanceTokenAddress,
      blockchainContainer.abi.governanceTokenABI,
      provider,
    );
    const balance = await governanceToken.balanceOf(wallet);
    const votes = await governanceToken.getCurrentVotes(wallet);
    const delegates = await governanceToken.delegates(wallet);

    return {
      balance: new BN(balance.toString()).div(1e18).toString(),
      votes: new BN(votes.toString()).div(1e18).toString(),
      delegates: delegates.toLowerCase(),
    };
  }

  static async currentVotes(
    network: string | number,
    governanceTokenAddress: string,
    wallet: string,
  ) {
    const blockchainContainer = container.blockchain.ethereum;
    const provider = blockchainContainer.byNetwork(network).provider();
    const governanceToken = blockchainContainer.contract(
      governanceTokenAddress,
      blockchainContainer.abi.governanceTokenABI,
      provider,
    );
    const votes = await governanceToken
      .getCurrentVotes(wallet)
      .then((v: ethers.BigNumber) => new BN(v.toString()));

    return votes.div(1e18).toString(10);
  }

  async getProposal(
    network: string | number,
    governorBravoAddress: string,
    proposalId: number,
    options: { cache: boolean },
  ): Promise<Proposal | null> {
    return this.semafor().synchronized(
      `defihelper:governance:proposal:${governorBravoAddress}:${proposalId}`,
      async () => {
        if (options.cache) {
          const cached = await this.proposalTable()
            .where({
              network: network.toString(),
              contract: governorBravoAddress,
              id: proposalId,
            })
            .andWhere('createdAt', '>=', dayjs().subtract(5, 'minutes').toDate())
            .limit(1)
            .first();
          if (cached) return cached;
        }

        const blockchainContainer = container.blockchain.ethereum;
        const provider = blockchainContainer.byNetwork(network).provider();
        const governorBravo = blockchainContainer.contract(
          governorBravoAddress,
          blockchainContainer.abi.governorBravoABI,
          provider,
        );
        const lastProposalId = await governorBravo
          .proposalCount()
          .then((v: ethers.BigNumber) => v.toNumber());
        if (proposalId <= 0 || proposalId > lastProposalId) return null;

        const votingDelay = await governorBravo.votingDelay();
        const proposalInfo = await governorBravo.proposals(proposalId);
        const proposalState = await governorBravo.state(proposalId);
        const createdBlockNumber = new BN(proposalInfo.startBlock.toString())
          .minus(votingDelay.toString())
          .toNumber();
        const proposalCreatedEvent = (
          await governorBravo.queryFilter(
            governorBravo.filters.ProposalCreated(),
            createdBlockNumber,
            createdBlockNumber,
          )
        )[0];
        if (!proposalCreatedEvent) return null;

        const [
          id,
          proposer,
          targets,
          values,
          signatures,
          calldatas,
          startBlock,
          endBlock,
          description,
        ] = proposalCreatedEvent.args ?? [];

        const proposal: Proposal = {
          network: network.toString(),
          contract: governorBravoAddress,
          id: id.toNumber(),
          proposer: proposer.toLowerCase(),
          eta: proposalInfo.eta.toNumber(),
          calldata: {
            targets: targets.map((target: string) => target.toLowerCase()),
            values: values.map((value: BN) => new BN(value.toString()).div(1e18).toString()),
            signatures,
            args: calldatas.map((data: string, i: number) => {
              const [, types] = signatures[i].substr(0, signatures[i].length - 1).split('(');

              return ethers.utils.defaultAbiCoder
                .decode(types.split(','), data)
                .map((arg: any) => arg.toString());
            }),
          },
          startBlock: startBlock.toNumber(),
          endBlock: endBlock.toNumber(),
          forVotes: new BN(proposalInfo.forVotes.toString()).div(1e18).toString(),
          againstVotes: new BN(proposalInfo.againstVotes.toString()).div(1e18).toString(),
          abstainVotes: new BN(proposalInfo.abstainVotes.toString()).div(1e18).toString(),
          canceled: proposalInfo.canceled,
          executed: proposalInfo.executed,
          state: [
            ProposalState.Pending,
            ProposalState.Active,
            ProposalState.Canceled,
            ProposalState.Defeated,
            ProposalState.Succeeded,
            ProposalState.Queued,
            ProposalState.Expired,
            ProposalState.Executed,
          ][proposalState],
          description,
          createdAt: new Date(),
        };
        await this.saveProposal(proposal);

        return proposal;
      },
      { ttl: 15 },
    );
  }

  async getReceipt(
    network: string | number,
    governorBravoAddress: string,
    proposalId: number,
    wallet: string,
    options: { cache: boolean },
  ): Promise<Receipt | null> {
    return this.semafor().synchronized(
      `defihelper:governance:receipt:${governorBravoAddress}:${proposalId}:${wallet}`,
      async () => {
        if (options.cache) {
          const cached = await this.receiptTable()
            .where({
              network: network.toString(),
              contract: governorBravoAddress,
              proposal: proposalId,
              address: wallet,
            })
            .andWhere('createdAt', '>=', dayjs().subtract(5, 'minutes').toDate())
            .limit(1)
            .first();
          if (cached) return cached;
        }

        const proposal = await this.getProposal(network, governorBravoAddress, proposalId, options);
        if (!proposal) return null;

        const blockchainContainer = container.blockchain.ethereum;
        const provider = blockchainContainer.byNetwork(network).provider();
        const governorBravo = blockchainContainer.contract(
          governorBravoAddress,
          blockchainContainer.abi.governorBravoABI,
          provider,
        );
        const receiptInfo = await governorBravo.getReceipt(proposalId, wallet);
        const voteCastEvents = await governorBravo.queryFilter(
          governorBravo.filters.VoteCast(wallet),
          proposal.startBlock,
        );
        const voteCastEvent = voteCastEvents.find(
          ({ args }) => args?.proposalId.toString() === proposalId.toString(),
        );
        if (!voteCastEvent) return null;

        const [, , , , reason] = voteCastEvent.args ?? [];

        const receipt: Receipt = {
          network: proposal.network,
          contract: proposal.contract,
          proposal: proposal.id,
          address: wallet,
          hasVoted: receiptInfo.hasVoted,
          support: [ReceiptSupport.Against, ReceiptSupport.For, ReceiptSupport.Abstain][
            receiptInfo.support
          ],
          votes: new BN(receiptInfo.votes.toString()).div(1e18).toString(),
          reason,
          createdAt: new Date(),
        };
        await this.saveReceipt(proposal, receipt);

        return receipt;
      },
      { ttl: 15 },
    );
  }

  async saveProposal(proposal: Proposal) {
    await this.proposalTable()
      .where({
        network: proposal.network,
        contract: proposal.contract,
        id: proposal.id,
      })
      .delete();
    await this.proposalTable().insert({
      ...proposal,
    });
  }

  async saveReceipt(proposal: Proposal, receipt: Receipt) {
    await this.receiptTable()
      .where({
        network: proposal.network,
        contract: proposal.contract,
        proposal: proposal.id,
        address: receipt.address,
      })
      .delete();
    await this.receiptTable().insert({ ...receipt });
  }
}
