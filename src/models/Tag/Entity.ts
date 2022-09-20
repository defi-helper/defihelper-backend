import { typedTableFactory } from '@services/Database';

export enum TagType {
  Tvl = 'tvl',
  Risk = 'risk',
  Pool = 'poolType',
}

export enum TagPreservedName {
  TvlHundredThousand = '100k+ TVL',
  TvlOneMillion = '1kk+ TVL',
  TvlTenMillion = '10kk+ TVL',
  TvlHundredMillion = '100kk+ TVL',

  RiskLow = 'Low Risk Level',
  RiskModerate = 'Moderate Risk Level',
  RiskHigh = 'High Risk Level',

  TypeStable = 'Stable',
  TypeStableVsNative = 'Stable vs Native',
  TypeMajorTokens = 'Major tokens',
}

interface TvlType {
  type: TagType.Tvl;
  name:
    | TagPreservedName.TvlHundredThousand
    | TagPreservedName.TvlOneMillion
    | TagPreservedName.TvlTenMillion
    | TagPreservedName.TvlHundredMillion;
}

interface RiskType {
  type: TagType.Risk;
  name: TagPreservedName.RiskLow | TagPreservedName.RiskModerate | TagPreservedName.RiskHigh;
}

interface SpecialMarkType {
  type: TagType.Pool;
  name:
    | TagPreservedName.TypeStable
    | TagPreservedName.TypeStableVsNative
    | TagPreservedName.TypeMajorTokens;
}

export type TagTypePair = TvlType | RiskType | SpecialMarkType;
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
