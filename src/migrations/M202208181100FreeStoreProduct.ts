import container from '@container';
import { ProductCode } from '@models/Store/Entity';

export default async () => {
  await container.model
    .storeService()
    .create(0, ProductCode.Notification, 'free notifications', 'free notifications', 1000000, 50);
};
