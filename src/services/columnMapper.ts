import OpenAI from 'openai';
import { logger, LogLevel } from '@/lib/logger';

export interface MappedLead {
  name?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  location?: string;
  ownerName?: string;
  company?: string;
  gst?: string;
  branch?: string;
  offer?: string;
  favoriteItem?: string;
  restaurantType?: string;
}

interface ColumnMapping {
  field: string;
  matchedColumns: string[];
  confidence: number;
}

export class ColumnMapper {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async mapColumns(headers: string[], sampleRow: Record<string, any>): Promise<ColumnMapping[]> {
    try {
      logger.info('mapper', 'Analyzing columns with AI', { headers });

      const prompt = this.buildPrompt(headers, sampleRow);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing spreadsheet data and identifying field mappings for a restaurant marketing system. Map columns to standardized field names.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_schema', json_schema: {
          type: 'object',
          properties: {
            mappings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  matchedColumns: { type: 'array', items: { type: 'string' } },
                  confidence: { type: 'number' }
                },
                required: ['field', 'matchedColumns', 'confidence']
              }
            }
          },
          required: ['mappings']
        }},
        temperature: 0.1,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      logger.info('mapper', 'Column mapping completed', { mappings: result.mappings });

      return result.mappings;
    } catch (error) {
      logger.error('mapper', 'Failed to map columns', { error, headers });
      throw error;
    }
  }

  private buildPrompt(headers: string[], sampleRow: Record<string, any>): string {
    return `Analyze these spreadsheet columns and map them to standard fields for a restaurant marketing system.

Available columns: ${headers.join(', ')}

Sample data row:
${JSON.stringify(sampleRow, null, 2)}

Map each column to one or more of these standard fields:
- name: Person's name (Customer Name, Owner Name, Client Name, Contact Person)
- businessName: Restaurant/business name (Restaurant, Company, Business, Firm)
- email: Email address
- phone: Phone number (Mobile, Contact, Phone Number)
- address: Full address
- city: City name
- location: Area/locality
- ownerName: Owner/proprietor name
- company: Company name
- gst: GST number
- branch: Branch name
- offer: Current offer/promotion
- favoriteItem: Popular/favorite dish
- restaurantType: Type of restaurant (Pizza, Biryani, Bakery, etc.)

For each standard field, provide:
1. The field name
2. Array of matching column names from the spreadsheet
3. Confidence score (0.0 to 1.0)

Return JSON with a "mappings" array. Only include fields that have matches. Be flexible with column name variations.`;
  }

  async enrichLead(rawData: Record<string, any>, mappings: ColumnMapping[]): Promise<MappedLead> {
    const lead: MappedLead = {};

    for (const mapping of mappings) {
      if (mapping.confidence < 0.5) continue;

      for (const column of mapping.matchedColumns) {
        const value = rawData[column];
        if (value && !lead[mapping.field as keyof MappedLead]) {
          (lead as any)[mapping.field] = String(value).trim();
          break;
        }
      }
    }

    return lead;
  }

  async generateMissingOffer(
    businessName: string | undefined,
    restaurantType: string | undefined,
    location: string | undefined
  ): Promise<string> {
    try {
      const prompt = `Generate a compelling food marketing offer for a restaurant business.

Business: ${businessName || 'Restaurant'}
Type: ${restaurantType || 'General'}
Location: ${location || 'Local'}

Generate ONE short, punchy offer (max 20 words). Examples:
- "Flat 25% OFF on all orders today"
- "Buy 1 Get 1 Free on all Pizzas"
- "Free delivery on orders above ₹500"
- "20% OFF on Family Pack Biryani"

Return only the offer text, no quotes or explanation.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a marketing expert for restaurants. Generate short, compelling offers.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 50,
        temperature: 0.8,
      });

      const offer = response.choices[0].message.content?.trim() || 'Flat 20% OFF';
      logger.info('mapper', 'Generated missing offer', { offer, businessName });
      return offer;
    } catch (error) {
      logger.warn('mapper', 'Failed to generate offer, using default', { error });
      return 'Flat 20% OFF';
    }
  }

  async detectRestaurantType(businessName: string | undefined, favoriteItem: string | undefined): Promise<string | undefined> {
    try {
      const prompt = `Identify the restaurant/food business type from this information.

Business Name: ${businessName || 'N/A'}
Favorite Item: ${favoriteItem || 'N/A'}

Possible types: Pizza, Biryani, Bakery, Chinese, South Indian, Burger, Chinese, Cloud Kitchen, Cafe, Fine Dining, Street Food, Dessert, etc.

Return only the type name, or "General" if unclear.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a restaurant classification expert. Identify cuisine/business type.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 20,
        temperature: 0.3,
      });

      const type = response.choices[0].message.content?.trim();
      logger.info('mapper', 'Detected restaurant type', { type, businessName });
      return type && type !== 'General' ? type : undefined;
    } catch (error) {
      logger.warn('mapper', 'Failed to detect restaurant type', { error });
      return undefined;
    }
  }
}