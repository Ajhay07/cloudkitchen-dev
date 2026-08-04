import axios from 'axios';
import twilio from 'twilio';
import { logger } from '@/lib/logger';

export interface WhatsAppMessage {
  to: string;
  body: string;
  mediaUrl?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class WhatsAppSender {
  private provider: 'meta' | 'twilio';
  private twilioClient?: twilio.Twilio;
  private metaToken: string;
  private metaPhoneNumberId: string;

  constructor() {
    this.provider = (process.env.WHATSAPP_PROVIDER as 'meta' | 'twilio') || 'meta';
    this.metaToken = process.env.META_WHATSAPP_TOKEN || '';
    this.metaPhoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID || '';

    if (this.provider === 'twilio') {
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }

    logger.info('whatsapp', `WhatsApp provider initialized: ${this.provider}`);
  }

  async sendMessage(message: WhatsAppMessage): Promise<SendResult> {
    try {
      logger.info('whatsapp', `Sending message to ${message.to}`);

      if (this.provider === 'meta') {
        return this.sendWithMeta(message);
      } else {
        return this.sendWithTwilio(message);
      }
    } catch (error) {
      logger.error('whatsapp', 'Failed to send message', { error, to: message.to });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async sendWithMeta(message: WhatsAppMessage): Promise<SendResult> {
    try {
      const url = `https://graph.facebook.com/v18.0/${this.metaPhoneNumberId}/messages`;
      
      const payload: any = {
        messaging_product: 'whatsapp',
        to: message.to,
        type: 'template',
        template: {
          name: 'marketing_poster',
          language: { code: 'en_US' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: message.body },
              ],
            },
          ],
        },
      };

      // Add media if provided
      if (message.mediaUrl) {
        payload.template.components.push({
          type: 'header',
          parameters: [
            {
              type: 'image',
              image: { link: message.mediaUrl },
            },
          ],
        });
      }

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.metaToken}`,
          'Content-Type': 'application/json',
        },
      });

      const messageId = response.data.messages[0].id;
      logger.info('whatsapp', 'Message sent with Meta', { messageId, to: message.to });

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      logger.error('whatsapp', 'Meta send failed', { error, to: message.to });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Meta API error',
      };
    }
  }

  private async sendWithTwilio(message: WhatsAppMessage): Promise<SendResult> {
    try {
      if (!this.twilioClient) {
        throw new Error('Twilio client not initialized');
      }

      const twilioMessage = await this.twilioClient.messages.create({
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:${message.to}`,
        body: message.body,
        ...(message.mediaUrl && { mediaUrl: [message.mediaUrl] }),
      });

      logger.info('whatsapp', 'Message sent with Twilio', { 
        messageSid: twilioMessage.sid, 
        to: message.to 
      });

      return {
        success: true,
        messageId: twilioMessage.sid,
      };
    } catch (error) {
      logger.error('whatsapp', 'Twilio send failed', { error, to: message.to });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Twilio API error',
      };
    }
  }

  getProvider(): 'meta' | 'twilio' {
    return this.provider;
  }
}