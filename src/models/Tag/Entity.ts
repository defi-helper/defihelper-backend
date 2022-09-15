import { tableFactoryLegacy } from '@services/Database';

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

// todo introduce type checking here, but idk how it have to be :(
export const TagPreservedTypeToNameBindings = {
  [TagPreservedName.TvlHundredThousand]: TagType.Tvl,
  [TagPreservedName.TvlOneMillion]: TagType.Tvl,
  [TagPreservedName.TvlHundredThousand]: TagType.Tvl,
  [TagPreservedName.TvlHundredThousand]: TagType.Tvl,

  [TagPreservedName.RiskLow]: TagType.Risk,
  [TagPreservedName.RiskModerate]: TagType.Risk,
  [TagPreservedName.RiskHigh]: TagType.Risk,

  [TagPreservedName.TypeStable]: TagType.Pool,
  [TagPreservedName.TypeStableVsNative]: TagType.Pool,
  [TagPreservedName.TypeMajorTokens]: TagType.Pool,
};

export interface Tag {
  id: string;
  type: TagType;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export const tagTableName = 'tag';

export const tagTableFactory = tableFactoryLegacy<Tag>(tagTableName);

export type TagTable = ReturnType<ReturnType<typeof tagTableFactory>>;
