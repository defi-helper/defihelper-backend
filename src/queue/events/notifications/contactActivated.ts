import container from '@container';
import { Process } from '@models/Queue/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;
  const contact = await container.model.userContactTable().where('id', id).first();
  if (!contact) throw new Error('Contact not found');

  const user = await container.model.userTable().where('id', contact.user).first();
  if (!user) throw new Error('User not found');

  await container.model.userService().update({
    ...user,
    isMetricsTracked: true,
  });

  return process.done();
};
