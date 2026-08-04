import OpenAI from 'openai';
import { logger } from '@/lib/logger';

export interface WhatsAppCopy {
  message: string;
  tone: string;
  personalization: string[];
}

export class WhatsAppCopywriter {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateCopy(params: {
    customerName?: string;
    businessName?: string;
    offer?: string;
    restaurantType?: string;
    cuisine?: string;
    tone?: 'professional' | 'casual' | 'friendly' | 'luxury' | 'energetic';
  }): Promise<WhatsAppCopy> {
    try {
      const {
        customerName = 'there',
        businessName = 'our restaurant',
        offer = 'an exclusive offer',
        restaurantType = 'restaurant',
        cuisine = 'delicious food',
        tone = 'friendly',
      } = params;

      logger.info('copywriter', 'Generating WhatsApp copy', { businessName, tone });

      const toneInstructions = {
        professional: 'Use a professional and respectful tone',
        casual: 'Use a casual and relaxed tone',
        friendly: 'Use a warm and friendly tone with emojis',
        luxury: 'Use an elegant and sophisticated tone',
        energetic: 'Use an enthusiastic and energetic tone',
      };

      const prompt = `Generate a personalized WhatsApp message for a restaurant marketing campaign.

CUSTOMER: ${customerName}
BUSINESS: ${businessName}
CUISINE: ${cuisine}
OFFER: ${offer}
RESTAURANT TYPE: ${restaurantType}

TONE: ${toneInstructions[tone] || toneInstructions.friendly}

Create a WhatsApp message that:
1. Greets the customer by name
2. Mentions we created a custom promotional poster for their business
3. Describes the poster briefly (premium design, AI-generated)
4. Encourages them to share on WhatsApp Status, Instagram, Facebook
5. Includes the offer details
6. Has a warm closing

Keep it under 200 words. Make it personal and engaging.

Return JSON:
{
  "message": "the complete WhatsApp message",
  "tone": "${tone}",
  "personalization": ["list of personalized elements used"]
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert WhatsApp marketing copywriter. Create engaging, personalized messages that drive engagement.' 
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
        max_tokens: 400,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      logger.info('copywriter', 'WhatsApp copy generated', { 
        tone,
        messageLength: result.message?.length || 0 
      });

      return {
        message: `Hi ${customerName}! We've created a premium promotional poster for ${businessName}. Share it on WhatsApp Status, Instagram, and Facebook to attract more customers. Don't miss out on ${offer}!`,
        tone: 'friendly',
        personalization: ['customer_name', 'business_name', 'offer'],
      };
    } catch (error) {
      logger.error('copywriter', 'Failed to generate WhatsApp copy', { error, params });
      // Return default copy on error
      const defaultName = params.customerName || 'there';
      const defaultBusiness = params.businessName || 'our restaurant';
      const defaultOffer = params.offer || 'an exclusive offer';
      return {
        message: `Hi ${defaultName}! We've created a premium promotional poster for ${defaultBusiness}. Share it on WhatsApp Status, Instagram, and Facebook to attract more customers. Don't miss out on ${defaultOffer}!`,
        tone: 'friendly',
        personalization: ['customer_name', 'business_name', 'offer'],
      };
    }
  }

  async generateBulkCopy(leads: Array<{
    id: string;
    name?: string;
    businessName?: string;
    offer?: string;
    restaurantType?: string;
  }>): Promise<Map<string, WhatsAppCopy>> {
    const results = new Map<string, WhatsAppCopy>();
    
    // Process in batches of 10
    const batchSize = 10;
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      const promises = batch.map(async (lead) => {
        const copy = await this.generateCopy({
          customerName: lead.name,
          businessName: lead.businessName,
          offer: lead.offer,
          restaurantType: lead.restaurantType,
        });
        results.set(lead.id, copy);
      });
      await Promise.all(promises);
      
      // Add delay between batches
      if (i + batchSize < leads.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}