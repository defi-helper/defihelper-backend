import * as Mustache from 'mustache';
import nodemailer, { Transporter } from 'nodemailer';
import container from '@container';
import { Templates } from './templates';

export type EmailTemplate = keyof typeof Templates;

export interface EmailServiceConfig {
  from: string;
  host: string;
  port: number;
  auth: {
    user: string;
    pass: string;
  };
}

export class EmailService {
  protected transporter?: Transporter;

  protected from: string;

  constructor(config: EmailServiceConfig) {
    if (config.host !== '') {
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        auth: {
          user: config.auth.user,
          pass: config.auth.pass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
    }

    this.from = config.from;
  }

  async send(template: EmailTemplate, data: Object, subject: string, to: string): Promise<void> {
    const html = Mustache.render(await Templates[template], data);

    const email = {
      from: {
        name: 'DeFiHelper service',
        address: this.from,
      },
      to,
      subject,
      html,
    };

    if (this.transporter) {
      await this.transporter.sendMail(email);
    } else {
      container.logger().info(JSON.stringify(email));
    }
  }
}

export function emailServiceFactory(config: EmailServiceConfig) {
  return () => new EmailService(config);
}
