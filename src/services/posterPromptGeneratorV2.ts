import OpenAI from 'openai';
import { logger } from '@/lib/logger';

export interface AdvancedPosterPrompt {
  prompt: string;
  negativePrompt: string;
  lighting: string;
  cameraAngle: string;
  mood: string;
  colorPalette: string[];
  emptySpaceDirection: string;
  style: string;
}

export class PosterPromptGeneratorV2 {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generatePrompt(params: {
    businessName?: string;
    cuisine?: string;
    foodItem?: string;
    offer?: string;
    layout?: string;
    brandColors?: string[];
  }): Promise<AdvancedPosterPrompt> {
    try {
      const {
        businessName = 'Restaurant',
        cuisine = 'General',
        foodItem = 'Delicious Food',
        offer = 'Flat 20% OFF',
        layout = 'premium_dark',
        brandColors = [],
      } = params;

      logger.info('prompt-v2', 'Generating advanced poster prompt', { businessName, cuisine, layout });

      const styleConfig = this.getStyleConfig(layout, cuisine);
      const colorPalette = brandColors.length > 0 ? brandColors : styleConfig.defaultColors;

      const prompt = `Create a commercial food photography background image for a restaurant marketing poster.

SUBJECT: ${foodItem} from ${cuisine} cuisine
BUSINESS: ${businessName}
PROMOTION: ${offer}

STYLE REQUIREMENTS:
- ${styleConfig.lighting} lighting
- ${styleConfig.cameraAngle} camera angle
- ${styleConfig.mood} mood and atmosphere
- Professional commercial food photography
- Instagram-quality, high resolution (1080x1080)
- ${styleConfig.style}

COMPOSITION:
- ${styleConfig.emptySpace} empty composition space for text overlay
- Leave ${styleConfig.emptySpacePercent}% of the frame clean and unobstructed
- Place main subject off-center to allow text space
- NO text, NO logos, NO watermarks, NO typography
- NO restaurant names, NO phone numbers, NO offers displayed
- Pure background image only

COLOR PALETTE: ${colorPalette.join(', ')}

TECHNICAL:
- Sharp focus on food subject
- Professional depth of field
- Vibrant colors with natural tones
- High contrast for text readability`;

      const negativePrompt = `text, typography, letters, words, logos, watermarks, signatures, restaurant names, phone numbers, offers, prices, buttons, UI elements, people, faces, hands, cluttered composition, low quality, blurry, amateur photography`;

      logger.info('prompt-v2', 'Advanced prompt generated', { 
        layout, 
        lighting: styleConfig.lighting,
        emptySpace: styleConfig.emptySpacePercent 
      });

      return {
        prompt,
        negativePrompt,
        lighting: styleConfig.lighting,
        cameraAngle: styleConfig.cameraAngle,
        mood: styleConfig.mood,
        colorPalette,
        emptySpaceDirection: styleConfig.emptySpace,
        style: styleConfig.style,
      };
    } catch (error) {
      logger.error('prompt-v2', 'Failed to generate advanced prompt', { error, params });
      throw error;
    }
  }

  private getStyleConfig(layout: string, cuisine: string): {
    lighting: string;
    cameraAngle: string;
    mood: string;
    style: string;
    emptySpace: string;
    emptySpacePercent: string;
    defaultColors: string[];
  } {
    const configs: Record<string, any> = {
      premium_dark: {
        lighting: 'Warm dramatic',
        cameraAngle: 'Overhead flat lay with slight angle',
        mood: 'Luxurious and sophisticated',
        style: 'Dark background with golden accents',
        emptySpace: 'Left side',
        emptySpacePercent: '40',
        defaultColors: ['#000000', '#FFD700', '#1a1a1a'],
      },
      luxury_gold: {
        lighting: 'Soft golden hour',
        cameraAngle: '45-degree angle',
        mood: 'Opulent and elegant',
        style: 'Rich gold and black marble background',
        emptySpace: 'Bottom',
        emptySpacePercent: '35',
        defaultColors: ['#000000', '#FFD700', '#8B4513'],
      },
      pizza: {
        lighting: 'Warm Italian sunset',
        cameraAngle: 'Eye-level with slight tilt',
        mood: 'Vibrant and appetizing',
        style: 'Red and gold Italian restaurant aesthetic',
        emptySpace: 'Right side',
        emptySpacePercent: '40',
        defaultColors: ['#8B0000', '#FFD700', '#FF6347'],
      },
      chinese: {
        lighting: 'Red lantern glow',
        cameraAngle: 'Overhead with depth',
        mood: 'Modern Asian fusion',
        style: 'Red and black with subtle gold',
        emptySpace: 'Left side',
        emptySpacePercent: '40',
        defaultColors: ['#8B0000', '#000000', '#FF0000'],
      },
      bakery: {
        lighting: 'Soft morning light',
        cameraAngle: 'Flat lay with overhead',
        mood: 'Warm and cozy',
        style: 'Pastel colors with wooden textures',
        emptySpace: 'Bottom',
        emptySpacePercent: '35',
        defaultColors: ['#DEB887', '#8B5A2B', '#FFE4C4'],
      },
      burger: {
        lighting: 'Bright and bold',
        cameraAngle: 'Eye-level with hero angle',
        mood: 'Energetic and American',
        style: 'Orange and black bold graphics',
        emptySpace: 'Right side',
        emptySpacePercent: '40',
        defaultColors: ['#FF8C00', '#000000', '#FF4500'],
      },
      cafe: {
        lighting: 'Natural window light',
        cameraAngle: '45-degree lifestyle shot',
        mood: 'Relaxed and cozy',
        style: 'Coffee tones with cream colors',
        emptySpace: 'Top',
        emptySpacePercent: '35',
        defaultColors: ['#654321', '#D2691E', '#FFE4C4'],
      },
      minimal: {
        lighting: 'Clean studio lighting',
        cameraAngle: 'Minimalist overhead',
        mood: 'Clean and modern',
        style: 'White or light gray background',
        emptySpace: 'Right side',
        emptySpacePercent: '50',
        defaultColors: ['#FFFFFF', '#000000', '#FFD700'],
      },
      offer_focus: {
        lighting: 'High contrast studio',
        cameraAngle: 'Hero shot with negative space',
        mood: 'Bold and urgent',
        style: 'Dark background with vibrant food',
        emptySpace: 'Center',
        emptySpacePercent: '45',
        defaultColors: ['#000000', '#FF4500', '#FFD700'],
      },
    };

    return configs[layout] || configs['premium_dark'];
  }
}