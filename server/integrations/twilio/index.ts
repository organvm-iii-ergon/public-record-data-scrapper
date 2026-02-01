/**
 * Twilio Integration Exports
 *
 * This module provides a unified interface for Twilio SMS and Voice capabilities.
 */

export { TwilioClient, twilioClient } from './client'
export type { TwilioConfig, TwilioResponse } from './client'

export { TwilioSMS, createTwilioSMS } from './sms'
export type { SendSMSOptions, SMSMessage, SMSStatus, SMSWebhookPayload } from './sms'

export { TwilioVoice, createTwilioVoice } from './voice'
export type {
  InitiateCallOptions,
  CallRecord,
  CallStatus,
  CallWebhookPayload,
  TwiMLOptions
} from './voice'
