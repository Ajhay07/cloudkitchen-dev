import OpenAI from 'openai';
import { logger } from '@/lib/logger';

export interface PosterPrompt {
  prompt: string;
  theme: string;
  layout: string;
  foodType: string;
}

export class PosterPromptGenerator {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generatePrompt(lead: {
    businessName?: string;
    name?: string;
    offer?: string;
    address?: string;
    phone?: string;
    restaurantType?: string;
    favoriteItem?: string;
  }): Promise<PosterPrompt> {
    try {
      const businessName = lead.businessName || 'Restaurant';
      const offer = lead.offer || 'Flat 20% OFF';
      const restaurantType = lead.restaurantType || 'General';
      const foodItem = lead.favoriteItem || this.getDefaultFoodItem(restaurantType);
      const theme = this.determineTheme(restaurantType, lead);

      const prompt = `Create a premium food promotion poster for Instagram (1080x1080).

Business: ${businessName}
${lead.name ? `Customer: ${lead.name}` : ''}
Offer: ${offer}
${lead.address ? `Location: ${lead.address}` : ''}
${lead.phone ? `Contact: ${lead.phone}` : ''}

Food Item: ${foodItem}
Theme: ${theme}

Style requirements:
- Modern, minimal design with dark background
- Premium food photography of ${foodItem}
- Professional commercial advertisement quality
- Elegant typography with good contrast
- Subtle shadows and depth
- Gradient accents
- Leave clear space at top for business name and middle for offer text
- High resolution, Instagram-ready square format

Make it look like a premium restaurant marketing poster.`;

      logger.info('poster', 'Generated poster prompt', { businessName, theme, foodItem });

      return {
        prompt,
        theme,
        layout: 'modern-minimal',
        foodType: restaurantType,
      };
    } catch (error) {
      logger.error('poster', 'Failed to generate poster prompt', { error, lead });
      throw error;
    }
  }

  private determineTheme(restaurantType: string, lead: Record<string, any>): string {
    const themes: Record<string, string> = {
      'Pizza': 'Vibrant red and gold, Italian-inspired',
      'Biryani': 'Rich royal colors, traditional elegance',
      'Bakery': 'Warm pastel colors, cozy bakery aesthetic',
      'Chinese': 'Red and black, modern Asian fusion',
      'South Indian': 'Traditional banana leaf green and gold',
      'Burger': 'American fast food, bold and energetic',
      'Cloud Kitchen': 'Modern dark theme with neon accents',
      'Cafe': 'Coffee brown and cream, relaxed vibe',
      'Fine Dining': 'Elegant black and gold, sophisticated',
      'Street Food': 'Vibrant colors, energetic and fun',
      'Dessert': 'Sweet pastel colors, playful',
      'General': 'Premium black and gold',
    };

    return themes[restaurantType] || 'Premium black and gold';
  }

  private getDefaultFoodItem(restaurantType: string): string {
    const defaults: Record<string, string> = {
      'Pizza': 'Pepperoni Pizza',
      'Biryani': 'Chicken Biryani',
      'Bakery': 'Fresh Baked Bread',
      'Chinese': 'Kung Pao Chicken',
      'South Indian': 'Masala Dosa',
      'Burger': 'Cheese Burger',
      'Cloud Kitchen': 'Special Thali',
      'Cafe': 'Coffee and Pastry',
      'Fine Dining': 'Gourmet Plated Dish',
      'Street Food': 'Chaat',
      'Dessert': 'Chocolate Cake',
      'General': 'Delicious Food',
    };

    return defaults[restaurantType] || 'Delicious Food';
  }
}