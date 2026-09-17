/**
 * SendGrid Integration Exports
 *
 * This module provides a unified interface for SendGrid email capabilities.
 */

export { SendGridClient, sendgridClient } from './client'
export type { SendGridConfig, SendGridResponse } from './client'

export { SendGridSend, createSendGridSend } from './send'
export type {
  EmailRecipient,
  EmailAttachment,
  SendTransactionalOptions,
  SendTemplateOptions,
  SendBulkOptions,
  EmailSendResult,
  WebhookEvent,
  SendGridEventType
} from './send'
