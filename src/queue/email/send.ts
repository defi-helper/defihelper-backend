import { Process } from '@models/Queue/Entity';
import container from '@container';
import { EmailTemplate } from '@services/Email';
import { Locale } from '@services/I18n/container';

export interface EmailNotification {
  email: string;
  template: EmailTemplate;
  subject: string;
  params: Object;
  locale: Locale;
}

export default async (process: Process) => {
  const { template, params, subject, email, locale } = process.task.params as EmailNotification;

  await container.email().send(template, params, subject, email, locale);

  return process.done();
};
