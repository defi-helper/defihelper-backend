import container from '@container';
import { Role } from '@models/User/Entity';

export default async () => {
  // Users
  const userService = container.model.userService();
  const walletService = container.model.walletService();
  const admin = await userService.create(Role.Admin, 'enUS');
  await walletService.create(
    admin,
    'ethereum',
    '1',
    '0x6e83b6ec760d69bfec1dee91f5f5e086df99fcbd',
    '0x047658345141c79f3b1a7dad3c0cce10f9a117604a61ab0dd880d68ee9d758f51adbea6f357ab83d5606238fd77225208ebc981f94ec6b7aacb1d859cc696e946e',
  );
  const user = await userService.create(Role.User, 'enUS');
  const userEthWallet = await walletService.create(
    user,
    'ethereum',
    '1',
    '0x9403932015576d13fb26b135ed7a35d5d95c18d4',
    '0x044a47a579a4965c3c5d22f0e92a293e10dc71f9fdd553a7a503e32903ca884d992d37e3a1e7195830367118bad8a71ec5649efd96733c2e2357e2db06675674d4',
  );
  const userEth2Wallet = await walletService.create(
    user,
    'ethereum',
    '1',
    '0xfd6ed8b66c5831e9e2e932404caf04cd288fc988',
    '',
  );
  const userBscWallet = await walletService.create(
    user,
    'ethereum',
    '56',
    '0x9403932015576d13fb26b135ed7a35d5d95c18d4',
    '0x044a47a579a4965c3c5d22f0e92a293e10dc71f9fdd553a7a503e32903ca884d992d37e3a1e7195830367118bad8a71ec5649efd96733c2e2357e2db06675674d4',
  );
  const userWavesWallet = await walletService.create(
    user,
    'waves',
    'main',
    '3PLSiHirrEedbi7imyfMCPRokwtGi3d4Xhg',
    '',
  );

  // Proposals
  const proposalService = container.model.proposalService();
  const proposal = await proposalService.create(
    'First proposal',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec posuere cursus ligula convallis tincidunt. Sed mattis massa vitae tortor faucibus pulvinar. Donec sagittis, lacus sed venenatis malesuada, risus libero laoreet augue, nec pharetra leo ligula molestie lorem. Mauris non mauris non sapien hendrerit commodo sed eget quam. Duis tempus metus nec feugiat rhoncus. Aenean nec orci turpis. Nam ut dui sollicitudin, efficitur nulla ac, placerat quam. Pellentesque convallis consectetur ligula et consectetur. Integer a lorem sed risus dictum porttitor. Nulla luctus sed metus tincidunt viverra. Integer rhoncus rutrum nunc, at blandit leo tincidunt at. Quisque vel turpis et tellus posuere aliquam ut in nisi. Fusce vitae mi quis lacus fermentum consectetur. Vestibulum pellentesque purus at malesuada pharetra. Suspendisse in finibus quam.',
    user,
  );
  await proposalService.vote(proposal, user);

  // Tokens
  const tokenAliasService = container.model.tokenAliasService();
  const tokenService = container.model.tokenService();
  const tokenAliasUnstable = await tokenAliasService.create('BondAppetit Governance', 'BAG', false);
  const tokenAliasStable = await tokenAliasService.create('Bond Appetite USD', 'USDap', true);
  await tokenService.create(
    tokenAliasStable,
    'ethereum',
    '1',
    '0x9a1997c130f4b2997166975d9aff92797d5134c2',
    'Bond Appetite USD',
    'USDap',
    18,
  );
  await tokenService.create(
    tokenAliasUnstable,
    'ethereum',
    '1',
    '0x28a06c02287e657ec3f8e151a13c36a1d43814b0',
    'BondAppetit Governance',
    'BAG',
    18,
  );

  // Protocol
  const protocolService = container.model.protocolService();
  const contractService = container.model.contractService();
  const protocolA = await protocolService.create(
    'bondappetit',
    'Bond Appetit',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    'https://bondappetit.io/static/media/bondappetit-hat.5299b28f.png',
    'https://bondappetit.io/',
    false,
  );
  const protocolAContractEth = await contractService.create(
    protocolA,
    'ethereum',
    '1',
    '0x969c70f75aecb0decbde0554fb570276c9a85751',
    null,
    'staking',
    'staking',
    'StableGovLPStaking',
    'Stable/Gov token staking',
    'https://bondappetit.io/staking/0x969c70f75aecb0decbde0554fb570276c9a85751',
    false,
  );
  await contractService.walletLink(protocolAContractEth, userEthWallet);
  await contractService.walletLink(protocolAContractEth, userEth2Wallet);
  const protocolAContractBsc = await contractService.create(
    protocolA,
    'ethereum',
    '56',
    '0x4f55b9fa30e3b11d0d6dee828fa905eaeaae62ee',
    null,
    'staking',
    'staking',
    'BnbGovLPStaking',
    'BNB/Gov token staking',
    'https://bondappetit.io/staking/0x4f55b9fa30e3b11d0d6dee828fa905eaeaae62ee',
    false,
  );
  await contractService.walletLink(protocolAContractBsc, userBscWallet);
  const protocolAContractWaves = await contractService.create(
    protocolA,
    'waves',
    'main',
    '3PAgYAV4jYJ7BF8LCVNU9tyWCBtQaqeLQH4',
    null,
    'swopfiStaking',
    'staking',
    'UsdnGovLPStaking',
    'USDN/Gov token staking',
    'https://swop.fi/info/3PAgYAV4jYJ7BF8LCVNU9tyWCBtQaqeLQH4',
    false,
  );
  await contractService.walletLink(protocolAContractWaves, userWavesWallet);
};
