import { MockCallData, Order } from '../Entity';

export default async function (order: Order<MockCallData>) {
  // eslint-disable-next-line no-console
  console.info(order);
  return null;
}
