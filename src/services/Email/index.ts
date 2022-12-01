import path from 'path';
import nodemailer, { Transporter } from 'nodemailer';
import container from '@container';
import { Locale } from '@services/I18n/container';
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

  async send<T extends EmailTemplate>(
    templateName: T,
    params: Parameters<typeof Templates[T]>[0],
    subject: string,
    to: string,
    locale: Locale,
  ) {
    const html = await Templates[templateName](params as any, locale);
    const email = {
      from: {
        name: 'DeFiHelper service',
        address: this.from,
      },
      to,
      subject,
      html,
      attachments: Array.from(html.matchAll(/"cid:(.+?)"/g)).map(([, filename]) => ({
        filename,
        path: path.resolve(__dirname, '../../../assets/images', filename),
        cid: filename,
      })),
    };

    if (this.transporter) {
      await this.transporter.sendMail(email);
    } else {
      container.logger().info(JSON.stringify(email));
    }
  }
}
