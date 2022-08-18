import { init, BaseRetryHandler, NodeClient } from '@amplitude/node';
import { User } from '@models/User/Entity';
import { Factory } from '@services/Container';

export class Amplitude {
  protected amplitudeInstance: NodeClient;

  constructor(apiKey: string) {
    this.amplitudeInstance = init(apiKey, {
      retryClass: new BaseRetryHandler(apiKey),
    });
  }

  async log(
    name: string,
    user: string | User,
    payload: {
      [key: string]: any;
    } = {},
  ) {
    const userId: string = typeof user === 'object' ? user.id : user;

    return this.amplitudeInstance.logEvent({
      event_type: name,
      user_id: userId,
      event_properties: payload,
    });
  }
}

export function amplitudeFactory(apiKey: string): Factory<Amplitude> {
  return () => new Amplitude(apiKey);
}
