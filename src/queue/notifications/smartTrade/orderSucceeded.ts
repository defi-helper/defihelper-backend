import { Process } from '@models/Queue/Entity';
import container from '@container';
import { ContactBroker, ContactStatus } from '@models/Notification/Entity';
import { OrderTokenLinkType, smartTradeOrderTokenLinkTableName } from '@models/SmartTrade/Entity';
import { Token, tokenTableName } from '@models/Token/Entity';

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const order = await container.model.smartTradeOrderTable().where('id', id).first();
  if (!order) {
    throw new Error('Order not found');
  }

  const ownerWallet = await container.model.walletTable().where('id', order.owner).first();
  if (!ownerWallet) {
    throw new Error('Owner wallet not found');
  }

  const contact = await container.model
    .userContactTable()
    .where('user', ownerWallet.user)
    .where('broker', ContactBroker.Telegram)
    .where('status', ContactStatus.Active)
    .first();
  if (!contact) return process.done();
  const { chatId } = contact.params ?? {};
  if (!chatId) {
    throw new Error(`Incorrect chatId: ${chatId}`);
  }

  const user = await container.model.userTable().where('id', ownerWallet.user).first();
  if (!user) {
    throw new Error('Owner account not found');
  }

  const tokens = await container.model
    .tokenTable()
    .column({ linkType: `${smartTradeOrderTokenLinkTableName}.type` })
    .column<Array<Token & { linkType: OrderTokenLinkType }>>(`${tokenTableName}.*`)
    .innerJoin(
      smartTradeOrderTokenLinkTableName,
      `${tokenTableName}.id`,
      `${smartTradeOrderTokenLinkTableName}.token`,
    )
    .where(`${smartTradeOrderTokenLinkTableName}.order`, order.id);
  const inToken = tokens.find(({ linkType }) => linkType === OrderTokenLinkType.In);
  const outToken = tokens.find(({ linkType }) => linkType === OrderTokenLinkType.Out);

  await container.telegram().send(
    'smartTradeOrderSucceeded',
    {
      name: inToken && outToken ? `${inToken.name}/${outToken.name}` : '',
      action: order.closed ? `closed by market price` : 'processed',
    },
    Number(chatId),
    user.locale,
  );

  return process.done();
};
