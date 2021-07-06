import * as Mustache from 'mustache';
import { Templates } from './templates';
import nodemailer, { Transporter } from 'nodemailer';
import container from "@container";

export type EmailTemplate = keyof typeof Templates;

export interface EmailServiceConfig {
    from: string;
    host: string;
    port: number;
    auth: {
        user: string;
        pass: string;
    }
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
                }
            });
        }

        this.from = config.from;
    }

    async send(template: EmailTemplate, data: Object, subject: string, to: string): Promise<void> {
        const html = Mustache.render(Templates[template], data);

        const email = {
            from: this.from,
            to: to,
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
