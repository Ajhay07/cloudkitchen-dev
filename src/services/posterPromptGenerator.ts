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

      // Deliberately a pure food-photography brief with no business name,
      // offer, or contact details, and an explicit no-text instruction:
      // Gemini was rendering those as literal captions baked into the
      // image, which then duplicated with posterComposer's own SVG text
      // overlay (which is the single source of truth for all on-poster text).
      const prompt = `Create a premium food photography background for an Instagram marketing poster (1080x1080).

Food Item: ${foodItem}
Theme: ${theme}

Style requirements:
- Modern, minimal design with dark background
- Premium, appetizing food photography of ${foodItem}, shot like a commercial advertisement
- Subtle shadows and depth, gradient accents
- Leave clear empty space at the top and in the middle of the frame (for text to be added later)
- High resolution, Instagram-ready square format

Absolutely no text, words, letters, numbers, or typography anywhere in the image - pure photography only, completely free of any writing.`;

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