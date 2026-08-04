export interface LayoutConfig {
  id: string;
  name: string;
  description: string;
  
  // Text positions
  businessNamePosition: { x: number; y: number; fontSize: number };
  offerPosition: { x: number; y: number; fontSize: number };
  addressPosition: { x: number; y: number; fontSize: number };
  phonePosition: { x: number; y: number; fontSize: number };
  customerNamePosition?: { x: number; y: number; fontSize: number };
  
  // Component positions
  logoPosition?: { x: number; y: number; width: number; height: number };
  foodPosition?: { x: number; y: number; width: number; height: number };
  ctaPosition?: { x: number; y: number };
  offerBadgePosition?: { x: number; y: number };
  qrPosition?: { x: number; y: number; size: number };
  ratingPosition?: { x: number; y: number };
  deliveryIconPosition?: { x: number; y: number };
  
  // Visual styling
  gradientOverlay: {
    enabled: boolean;
    colors: string[];
    direction: 'vertical' | 'horizontal' | 'diagonal';
  };
  
  // Typography
  fonts: {
    businessName: string;
    offer: string;
    body: string;
  };
  
  // Colors
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
  };
}

export const LAYOUTS: Record<string, LayoutConfig> = {
  premium_dark: {
    id: 'premium_dark',
    name: 'Premium Dark',
    description: 'Elegant dark theme with gold accents',
    businessNamePosition: { x: 540, y: 120, fontSize: 48 },
    offerPosition: { x: 540, y: 500, fontSize: 72 },
    addressPosition: { x: 540, y: 900, fontSize: 26 },
    phonePosition: { x: 540, y: 940, fontSize: 24 },
    customerNamePosition: { x: 540, y: 180, fontSize: 28 },
    gradientOverlay: {
      enabled: true,
      colors: ['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)'],
      direction: 'vertical',
    },
    fonts: {
      businessName: 'Arial',
      offer: 'Arial',
      body: 'Arial',
    },
    colors: {
      primary: '#FFD700',
      secondary: '#000000',
      accent: '#FFFFFF',
      text: '#FFFFFF',
    },
  },
  luxury_gold: {
    id: 'luxury_gold',
    name: 'Luxury Gold',
    description: 'Opulent gold and black theme for fine dining',
    businessNamePosition: { x: 540, y: 100, fontSize: 52 },
    offerPosition: { x: 540, y: 480, fontSize: 76 },
    addressPosition: { x: 540, y: 920, fontSize: 28 },
    phonePosition: { x: 540, y: 960, fontSize: 26 },
    customerNamePosition: { x: 540, y: 160, fontSize: 30 },
    gradientOverlay: {
      enabled: true,
      colors: ['rgba(0,0,0,0.9)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.9)'],
      direction: 'vertical',
    },
    fonts: {
      businessName: 'Georgia',
      offer: 'Georgia',
      body: 'Arial',
    },
    colors: {
      primary: '#FFD700',
      secondary: '#000000',
      accent: '#DAA520',
      text: '#FFFFFF',
    },
  },
  pizza: {
    id: 'pizza',
    name: 'Pizza',
    description: 'Vibrant red and gold Italian theme',
    businessNamePosition: { x: 540, y: 110, fontSize: 50 },
    offerPosition: { x: 540, y: 490, fontSize: 74 },
    addressPosition: { x: 540, y: 910, fontSize: 27 },
    phonePosition: { x: 540, y: 950, fontSize: 25 },
    customerNamePosition: { x: 540, y: 170, fontSize: 29 },
    gradientOverlay: {
      enabled: true,
      colors: ['rgba(139,0,0,0.8)', 'rgba(0,0,0,0.3)', 'rgba(139,0,0,0.8)'],
      direction: 'vertical',
    },
    fonts: {
      businessName: 'Arial',
      offer: 'Arial',
      body: 'Arial',
    },
    colors: {
      primary: '#FFD700',
      secondary: '#8B0000',
      accent: '#FF6347',
      text: '#FFFFFF',
    },
  },
  chinese: {
    id: 'chinese',
    name: 'Chinese',
    description: 'Red and black modern Asian fusion',
    businessNamePosition: { x: 540, y: 110, fontSize: 50 },
    offerPosition: { x: 540, y: 490, fontSize: 74 },
    addressPosition: { x: 540, y: 910, fontSize: 27 },
    phonePosition: { x: 540, y: 950, fontSize: 25 },
    customerNamePosition: { x: 540, y: 170, fontSize: 29 },
    gradientOverlay: {
      enabled: true,
      colors: ['rgba(139,0,0,0.8)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)'],
      direction: 'vertical',
    },
    fonts: {
      businessName: 'Arial',
      offer: 'Arial',
      body: 'Arial',
    },
    colors: {
      primary: '#FFD700',
      secondary: '#8B0000',
      accent: '#FF0000',
      text: '#FFFFFF',
    },
  },
  bakery: {
    id: 'bakery',
    name: 'Bakery',
    description: 'Warm pastel colors cozy aesthetic',
    businessNamePosition: { x: 540, y: 110, fontSize: 50 },
    offerPosition: { x: 540, y: 490, fontSize: 74 },
    addressPosition: { x: 540, y: 910, fontSize: 27 },
    phonePosition: { x: 540, y: 950, fontSize: 25 },
    customerNamePosition: { x: 540, y: 170, fontSize: 29 },
    gradientOverlay: {
      enabled: true,
      colors: ['rgba(139,90,43,0.7)', 'rgba(0,0,0,0.2)', 'rgba(139,90,43,0.7)'],
      direction: 'vertical',
    },
    fonts: {
      businessName: 'Arial',
      offer: 'Arial',
      body: 'Arial',
    },
    colors: {
      primary: '#FFD700',
      secondary: '#8B5A2B',
      accent: '#DEB887',
      text: '#FFFFFF',
    },
  },
  burger: {
    id: 'burger',
    name: 'Burger',
    description: 'American fast food bold energetic',
    businessNamePosition: { x: 540, y: 110, fontSize: 50 },
    offerPosition: { x: 540, y: 490, fontSize: 74 },
    addressPosition: { x: 540, y: 910, fontSize: 27 },
    phonePosition: { x: 540, y: 950, fontSize: 25 },
    customerNamePosition: { x: 540, y: 170, fontSize: 29 },
    gradientOverlay: {
      enabled: true,
      colors: ['rgba(255,140,0,0.8)', 'rgba(0,0,0,0.3)', 'rgba(255,140,0,0.8)'],
      direction: 'vertical',
    },
    fonts: {
      businessName: 'Arial',
      offer: 'Arial',
      body: 'Arial',
    },
    colors: {
      primary: '#FFD700',
      secondary: '#FF8C00',
      accent: '#FF4500',
      text: '#FFFFFF',
    },
  },
  cafe: {
    id: 'cafe',
    name: 'Cafe',
    description: 'Coffee brown cream relaxed vibe',
    businessNamePosition: { x: 540, y: 110, fontSize: 50 },
    offerPosition: { x: 540, y: 490, fontSize: 74 },
    addressPosition: { x: 540, y: 910, fontSize: 27 },
    phonePosition: { x: 540, y: 950, fontSize: 25 },
    customerNamePosition: { x: 540, y: 170, fontSize: 29 },
    gradientOverlay: {
      enabled: true,
      colors: ['rgba(101,67,33,0.7)', 'rgba(0,0,0,0.2)', 'rgba(101,67,33,0.7)'],
      direction: 'vertical',
    },
    fonts: {
      businessName: 'Arial',
      offer: 'Arial',
      body: 'Arial',
    },
    colors: {
      primary: '#FFD700',
      secondary: '#654321',
      accent: '#D2691E',
      text: '#FFFFFF',
    },
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean minimalist design',
    businessNamePosition: { x: 540, y: 120, fontSize: 48 },
    offerPosition: { x: 540, y: 500, fontSize: 72 },
    addressPosition: { x: 540, y: 900, fontSize: 26 },
    phonePosition: { x: 540, y: 940, fontSize: 24 },
    customerNamePosition: { x: 540, y: 180, fontSize: 28 },
    gradientOverlay: {
      enabled: true,
      colors: ['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.7)'],
      direction: 'vertical',
    },
    fonts: {
      businessName: 'Arial',
      offer: 'Arial',
      body: 'Arial',
    },
    colors: {
      primary: '#FFFFFF',
      secondary: '#000000',
      accent: '#FFD700',
      text: '#FFFFFF',
    },
  },
  offer_focus: {
    id: 'offer_focus',
    name: 'Offer Focus',
    description: 'Emphasizes the offer with bold typography',
    businessNamePosition: { x: 540, y: 140, fontSize: 44 },
    offerPosition: { x: 540, y: 460, fontSize: 82 },
    addressPosition: { x: 540, y: 880, fontSize: 26 },
    phonePosition: { x: 540, y: 920, fontSize: 24 },
    customerNamePosition: { x: 540, y: 200, fontSize: 28 },
    offerBadgePosition: { x: 900, y: 100 },
    gradientOverlay: {
      enabled: true,
      colors: ['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)'],
      direction: 'vertical',
    },
    fonts: {
      businessName: 'Arial',
      offer: 'Arial',
      body: 'Arial',
    },
    colors: {
      primary: '#FF4500',
      secondary: '#000000',
      accent: '#FFD700',
      text: '#FFFFFF',
    },
  },
  split: {
    id: 'split',
    name: 'Split',
    description: 'Split layout with image on one side',
    businessNamePosition: { x: 750, y: 120, fontSize: 48 },
    offerPosition: { x: 750, y: 500, fontSize: 72 },
    addressPosition: { x: 750, y: 900, fontSize: 26 },
    phonePosition: { x: 750, y: 940, fontSize: 24 },
    customerNamePosition: { x: 750, y: 180, fontSize: 28 },
    foodPosition: { x: 0, y: 0, width: 540, height: 1080 },
    gradientOverlay: {
      enabled: true,
      colors: ['rgba(0,0,0,0.9)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.9)'],
      direction: 'horizontal',
    },
    fonts: {
      businessName: 'Arial',
      offer: 'Arial',
      body: 'Arial',
    },
    colors: {
      primary: '#FFD700',
      secondary: '#000000',
      accent: '#FFFFFF',
      text: '#FFFFFF',
    },
  },
  hero: {
    id: 'hero',
    name: 'Hero',
    description: 'Hero image with overlay text',
    businessNamePosition: { x: 540, y: 200, fontSize: 56 },
    offerPosition: { x: 540, y: 550, fontSize: 78 },
    addressPosition: { x: 540, y: 950, fontSize: 28 },
    phonePosition: { x: 540, y: 990, fontSize: 26 },
    customerNamePosition: { x: 540, y: 260, fontSize: 32 },
    foodPosition: { x: 0, y: 0, width: 1080, height: 1080 },
    gradientOverlay: {
      enabled: true,
      colors: ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)'],
      direction: 'vertical',
    },
    fonts: {
      businessName: 'Arial',
      offer: 'Arial',
      body: 'Arial',
    },
    colors: {
      primary: '#FFD700',
      secondary: '#000000',
      accent: '#FFFFFF',
      text: '#FFFFFF',
    },
  },
  food_focus: {
    id: 'food_focus',
    name: 'Food Focus',
    description: 'Food image centered with text around',
    businessNamePosition: { x: 540, y: 80, fontSize: 46 },
    offerPosition: { x: 540, y: 1000, fontSize: 70 },
    addressPosition: { x: 540, y: 960, fontSize: 24 },
    phonePosition: { x: 540, y: 1000, fontSize: 22 },
    customerNamePosition: { x: 540, y: 140, fontSize: 26 },
    foodPosition: { x: 190, y: 200, width: 700, height: 600 },
    gradientOverlay: {
      enabled: true,
      colors: ['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)'],
      direction: 'vertical',
    },
    fonts: {
      businessName: 'Arial',
      offer: 'Arial',
      body: 'Arial',
    },
    colors: {
      primary: '#FFD700',
      secondary: '#000000',
      accent: '#FFFFFF',
      text: '#FFFFFF',
    },
  },
};

export class LayoutEngine {
  getLayout(layoutId: string): LayoutConfig {
    return LAYOUTS[layoutId] || LAYOUTS['premium_dark'];
  }

  getAllLayouts(): LayoutConfig[] {
    return Object.values(LAYOUTS);
  }

  getLayoutsByCategory(category: string): LayoutConfig[] {
    const categoryMap: Record<string, string[]> = {
      cuisine: ['pizza', 'chinese', 'bakery', 'burger', 'cafe'],
      modern: ['minimal', 'premium_dark', 'luxury_gold'],
      focus: ['offer_focus', 'food_focus'],
      layout: ['split', 'hero'],
    };
    
    const layoutIds = categoryMap[category] || [];
    return layoutIds.map(id => LAYOUTS[id]).filter(Boolean);
  }

  recommendLayout(businessIntelligence: {
    cuisine: string;
    segment: string;
    atmosphere: string;
  }): string {
    if (businessIntelligence.atmosphere === 'fine_dining' || businessIntelligence.segment === 'premium') {
      return 'luxury_gold';
    }
    
    const cuisineLower = businessIntelligence.cuisine.toLowerCase();
    if (cuisineLower.includes('pizza')) return 'pizza';
    if (cuisineLower.includes('chinese') || cuisineLower.includes('asian')) return 'chinese';
    if (cuisineLower.includes('bakery') || cuisineLower.includes('cake')) return 'bakery';
    if (cuisineLower.includes('burger') || cuisineLower.includes('american')) return 'burger';
    if (cuisineLower.includes('cafe') || cuisineLower.includes('coffee')) return 'cafe';
    
    if (businessIntelligence.atmosphere === 'trendy' || businessIntelligence.atmosphere === 'casual') {
      return 'minimal';
    }
    
    return 'premium_dark';
  }
}