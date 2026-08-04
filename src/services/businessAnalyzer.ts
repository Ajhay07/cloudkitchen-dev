import OpenAI from 'openai';
import { logger } from '@/lib/logger';

export interface BusinessIntelligence {
  cuisine: string;
  segment: string;
  targetAudience: string;
  businessModel: string;
  priceRange: string;
  atmosphere: string;
  marketingTone: string;
  recommendedLayout: string;
  colorPalette: string[];
  confidence: number;
}

export class BusinessAnalyzer {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async analyzeBusiness(lead: {
    businessName?: string;
    restaurantType?: string;
    favoriteItem?: string;
    offer?: string;
    address?: string;
    city?: string;
  }): Promise<BusinessIntelligence> {
    try {
      logger.info('business-analyzer', 'Analyzing business intelligence', { 
        businessName: lead.businessName,
        restaurantType: lead.restaurantType 
      });

      const prompt = `Analyze this restaurant business and provide structured intelligence.

Business Name: ${lead.businessName || 'Unknown'}
Restaurant Type: ${lead.restaurantType || 'Unknown'}
Signature Item: ${lead.favoriteItem || 'Unknown'}
Current Offer: ${lead.offer || 'None'}
Location: ${lead.address || lead.city || 'Unknown'}

Provide analysis in JSON format:
{
  "cuisine": "specific cuisine type (Pizza, Biryani, Chinese, South Indian, etc.)",
  "segment": "premium | budget | mid_range",
  "targetAudience": "family | youth | corporate | tourists | general",
  "businessModel": "cloud_kitchen | dine_in | delivery | takeaway | mixed",
  "priceRange": "₹ | ₹₹ | ₹₹₹",
  "atmosphere": "casual | fine_dining | trendy | cozy | street_food",
  "marketingTone": "professional | casual | friendly | luxury | energetic",
  "recommendedLayout": "premium_dark | luxury_gold | pizza | chinese | bakery | burger | cafe | minimal | offer_focus",
  "colorPalette": ["#hex1", "#hex2", "#hex3"],
  "confidence": 0.0-1.0
}

Choose layout based on cuisine and atmosphere. Be specific and accurate.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: 'You are a restaurant marketing analyst. Provide structured JSON analysis of business intelligence.' 
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 500,
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}') as BusinessIntelligence;
      
      logger.info('business-analyzer', 'Business analysis completed', { 
        cuisine: analysis.cuisine,
        segment: analysis.segment,
        layout: analysis.recommendedLayout 
      });

      return analysis;
    } catch (error) {
      logger.error('business-analyzer', 'Failed to analyze business', { error, lead });
      // Return default analysis
      return {
        cuisine: lead.restaurantType || 'General',
        segment: 'mid_range',
        targetAudience: 'general',
        businessModel: 'delivery',
        priceRange: '₹₹',
        atmosphere: 'casual',
        marketingTone: 'friendly',
        recommendedLayout: 'premium_dark',
        colorPalette: ['#FFD700', '#000000', '#FFFFFF'],
        confidence: 0.5,
      };
    }
  }

  async batchAnalyze(leads: Array<{
    id: string;
    businessName?: string;
    restaurantType?: string;
    favoriteItem?: string;
    offer?: string;
  }>): Promise<Map<string, BusinessIntelligence>> {
    const results = new Map<string, BusinessIntelligence>();
    
    // Process in batches of 10 to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      const promises = batch.map(async (lead) => {
        const analysis = await this.analyzeBusiness(lead);
        results.set(lead.id, analysis);
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