import { MockCallData, Order } from '../Entity';

export default async function (order: Order<MockCallData>) {
  console.info(order);
  return null;
}
