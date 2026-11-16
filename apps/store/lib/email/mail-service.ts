import { attachPersistence } from '../../../../packages/local-db/index.mjs';
import crypto from 'node:crypto';
import { logger } from '@prototype/logger';

export interface MailLogEntry {
  id: string;
  to: string;
  subject: string;
  bodyHtml: string;
  sentVia: string;
  status: 'sent' | 'failed';
  createdAt: string;
}

export class MailService {
  private logs: MailLogEntry[] = [];

  public async sendEmail(params: {
    to: string;
    subject: string;
    bodyHtml: string;
  }): Promise<MailLogEntry> {
    const sentVia = process.env.RESEND_API_KEY ? 'resend' : 'in_app_mail_log';
    
    const entry: MailLogEntry = {
      id: crypto.randomUUID(),
      to: params.to,
      subject: params.subject,
      bodyHtml: params.bodyHtml,
      sentVia,
      status: 'sent',
      createdAt: new Date().toISOString()
    };

    this.logs.unshift(entry);

    logger.info(
      { to: params.to, subject: params.subject, sentVia },
      'Email processed and recorded to mail_log'
    );

    return entry;
  }

  public getLogs(): MailLogEntry[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs = [];
  }
}

export const mailService = new MailService();


Object.setPrototypeOf(mailService, MailService.prototype);
attachPersistence(mailService, 'store', 'mail');


