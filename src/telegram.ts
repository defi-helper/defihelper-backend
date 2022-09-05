import 'source-map-support/register';
import 'module-alias/register';
import container from '@container';
import { ContactBroker, ContactStatus } from '@models/Notification/Entity';
import { utils } from 'ethers';
import {
  walletBlockchainTableName,
  WalletBlockchainType,
  walletTableName,
} from '@models/Wallet/Entity';
import { Role } from '@models/User/Entity';

container.logger().info(`Bot is listening`);
const bot = container.telegram().getBot();

if (!bot) {
  throw new Error('You have to specify telegram configuration');
}

bot.start(async ({ message }) => {
  const confirmationCode = message.text.replace('/start ', '');
  const userContact = await container.model
    .userContactTable()
    .where('confirmationCode', confirmationCode)
    .first();

  if (userContact && userContact.status !== ContactStatus.Active) {
    await container.model.userContactService().activate(userContact, message.from?.username || '', {
      chatId: message.chat.id.toString(),
    });
    const user = await container.model.userTable().where('id', userContact.user).first();
    return container
      .telegram()
      .send('welcomeTemplate', {}, message.chat.id, user?.locale || 'enUS');
  }

  return container.telegram().send('welcomeNewWalletConnect', {}, message.chat.id, 'enUS');
});

bot.on('text', async (ctx) => {
  if (!utils.isAddress(ctx.message.text)) {
    return ctx.reply(
      'Right now, I understand only Ethereum addresses(ex. 0xc1912fee45d61c87cc5ea59dae31190fffff232d) :(',
    );
  }

  const inputAddress = ctx.message.text.toLowerCase();
  const foundWallet = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where(`${walletBlockchainTableName}.address`, inputAddress)
    .first();

  if (foundWallet) {
    return ctx.reply('You already have an account, please login at https://app.defihelper.io');
  }

  const user = await container.model.userService().create(Role.User, 'UTC');
  await container.model
    .walletService()
    .createBlockchainWallet(
      user,
      'ethereum',
      '1',
      WalletBlockchainType.Wallet,
      inputAddress,
      '',
      '',
      false,
    );

  const username = ctx.message.from?.username || '';
  const existingContact = await container.model
    .userContactTable()
    .whereRaw(`params->>'chatId' = '${ctx.chat.id}'`)
    .first();

  if (existingContact) {
    await Promise.all([
      container.model.userContactService().activate(existingContact, username, {
        chatId: String(ctx.chat.id),
      }),
      container.model.userContactService().update({
        ...existingContact,
        user: user.id,
      }),
    ]);
  }

  const contact = await container.model
    .userContactService()
    .create(ContactBroker.Telegram, username, user, 'Telegram account');

  await container.model.userContactService().activate(contact, username, {
    chatId: String(ctx.chat.id),
  });

  return ctx.reply(
    "Great work! Everything's done, now you can use the app at https://app.defihelper.io",
  );
});
