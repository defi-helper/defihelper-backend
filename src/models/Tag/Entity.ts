import { typedTableFactory } from '@services/Database';

export enum TagType {
  Tvl = 'tvl',
  Risk = 'risk',
  Pool = 'poolType',
}

export enum TagPreservedName {
  TvlHundredThousand = '$100k — $1m TVL',
  TvlOneMillion = '$1m — $10m TVL',
  TvlTenMillion = '$10m — $100m TVL',
  TvlHundredMillion = '$100m+ TVL',

  RiskLow = 'Low risk',
  RiskModerate = 'Moderate risk',
  RiskHigh = 'High risk',
  TypeStable = 'Stable',
  TypeStableVsNative = 'Stable vs native',
  TypeMajorTokens = 'Major tokens',
}

export interface TagTvlType {
  type: TagType.Tvl;
  name:
    | TagPreservedName.TvlHundredThousand
    | TagPreservedName.TvlOneMillion
    | TagPreservedName.TvlTenMillion
    | TagPreservedName.TvlHundredMillion;
}

export interface TagRiskType {
  type: TagType.Risk;
  name: TagPreservedName.RiskLow | TagPreservedName.RiskModerate | TagPreservedName.RiskHigh;
}

export interface TagSpecialMarkType {
  type: TagType.Pool;
  name:
    | TagPreservedName.TypeStable
    | TagPreservedName.TypeStableVsNative
    | TagPreservedName.TypeMajorTokens;
}

export type TagTypePair = TagTvlType | TagRiskType | TagSpecialMarkType;
export type Tag = {
  id: string;
  createdAt: Date;
} & TagTypePair;

export const tagTableName = 'tag';

export const tagTableFactory = typedTableFactory(tagTableName);

export type TagTable = ReturnType<ReturnType<typeof tagTableFactory>>;

declare module 'knex/types/tables' {
  interface Tables {
    [tagTableName]: Tag;
  }
}
