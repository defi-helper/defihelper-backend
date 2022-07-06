import * as Mustache from 'mustache';
import { nodeInteraction } from '@waves/waves-transactions';
import { Factory } from '@services/Container';

export class WavesNodeService {
  async nativeBalance(address: string): Promise<void> {
    const balance = await nodeInteraction.balance(address, 'https://nodes.wavesnodes.com');

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
    });
  }
}

export function wavesNodeServiceFactory(token: string): Factory<WavesNodeService> {
  return () => new WavesNodeService();
}
