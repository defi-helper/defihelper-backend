import { Process } from "@models/Queue/Entity";
import container from "@container";
import { EmailTemplate } from "@services/Email";

export interface EmailNotification {
  email: string;
  template: EmailTemplate;
  subject: string;
  params: Object;
}

export default async (process: Process) => {
  const emailNotification = process.task.params as EmailNotification;
  
  await container.email().send(
    emailNotification.template,
    emailNotification.params,
    emailNotification.subject,
    emailNotification.email,
  )

  return process.done();
};
