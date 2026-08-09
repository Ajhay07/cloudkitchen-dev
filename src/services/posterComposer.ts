import sharp, { Sharp } from 'sharp';
import { logger } from '@/lib/logger';
import QRCode from 'qrcode';

export interface PosterCompositionInput {
  backgroundImageUrl: string;
  businessName: string;
  offer: string;
  address?: string;
  phone?: string;
  customerName?: string;
  theme: string;
}

export class PosterComposer {
  async composePoster(input: PosterCompositionInput): Promise<Buffer> {
    try {
      logger.info('poster', 'Composing poster with Sharp', { businessName: input.businessName });

      // Download background image
      const backgroundBuffer = await this.downloadImage(input.backgroundImageUrl);
      
      // Create base image with dark theme overlay
      let baseImage = sharp(backgroundBuffer)
        .resize(1080, 1080, { fit: 'cover' })
        .modulate({ brightness: 0.7 });

      // Add gradient overlay based on theme
      baseImage = this.applyThemeOverlay(baseImage, input.theme);

      // Create final composition
      const svgOverlay = this.createTextOverlay(input);
      
      const finalBuffer = await baseImage
        .composite([
          {
            input: Buffer.from(svgOverlay),
            top: 0,
            left: 0,
          },
        ])
        .jpeg({ quality: 95 })
        .toBuffer();

      logger.info('poster', 'Poster composed successfully', { size: finalBuffer.length });
      return finalBuffer;
    } catch (error) {
      logger.error('poster', 'Failed to compose poster', { error, input });
      throw error;
    }
  }

  private async downloadImage(url: string): Promise<Buffer> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      logger.error('poster', 'Failed to download background image', { error, url });
      throw error;
    }
  }

  private applyThemeOverlay(image: Sharp, theme: string): Sharp {
    // Apply dark gradient overlay
    const gradientSvg = this.createGradientOverlay(theme);
    return image.composite([
      {
        input: Buffer.from(gradientSvg),
        top: 0,
        left: 0,
      },
    ]);
  }

  private createGradientOverlay(theme: string): string {
    // Create a dark gradient overlay
    return `<svg width="1080" height="1080">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:rgba(0,0,0,0.7);stop-opacity:1" />
          <stop offset="50%" style="stop-color:rgba(0,0,0,0.3);stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgba(0,0,0,0.8);stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="1080" height="1080" fill="url(#grad)" />
    </svg>`;
  }

  private createTextOverlay(input: PosterCompositionInput): string {
    const { businessName, offer, address, phone, customerName } = input;

    // Truncate long text
    const truncatedBusinessName = businessName.length > 30 ? businessName.substring(0, 27) + '...' : businessName;
    const truncatedOffer = offer.length > 40 ? offer.substring(0, 37) + '...' : offer;

    return `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.5"/>
        </filter>
      </defs>
      
      <!-- Background overlay for text readability -->
      <rect x="0" y="0" width="1080" height="1080" fill="rgba(0,0,0,0.3)" />
      
      <!-- Business Name (top) -->
      <text x="540" y="120" font-family="Arial, sans-serif" font-size="48" font-weight="bold" 
            fill="#FFD700" text-anchor="middle" filter="url(#shadow)">
        ${this.escapeXml(truncatedBusinessName)}
      </text>
      
      ${customerName ? `
      <!-- Customer Name -->
      <text x="540" y="180" font-family="Arial, sans-serif" font-size="28" 
            fill="#FFFFFF" text-anchor="middle" opacity="0.9">
        ${this.escapeXml(customerName)}
      </text>
      ` : ''}
      
      <!-- Divider Line -->
      <line x1="200" y1="220" x2="880" y2="220" stroke="#FFD700" stroke-width="2" opacity="0.6"/>
      
      <!-- Offer (center, large) -->
      <text x="540" y="480" font-family="Arial, sans-serif" font-size="72" font-weight="bold" 
            fill="#FFFFFF" text-anchor="middle" filter="url(#shadow)">
        ${this.escapeXml(truncatedOffer)}
      </text>
      
      <!-- "SPECIAL OFFER FOR YOU" label -->
      <text x="540" y="420" font-family="Arial, sans-serif" font-size="28" 
            fill="#FFD700" text-anchor="middle" letter-spacing="3">
        SPECIAL OFFER FOR YOU
      </text>
      
      <!-- Address (bottom) -->
      ${address ? `
      <text x="540" y="900" font-family="Arial, sans-serif" font-size="26" 
            fill="#FFFFFF" text-anchor="middle" opacity="0.9">
        ${this.escapeXml(address.length > 50 ? address.substring(0, 47) + '...' : address)}
      </text>
      ` : ''}
      
      <!-- Phone (bottom) -->
      ${phone ? `
      <text x="540" y="940" font-family="Arial, sans-serif" font-size="24" 
            fill="#FFD700" text-anchor="middle">
        ${this.escapeXml(phone)}
      </text>
      ` : ''}
      
      <!-- Branding -->
      <text x="540" y="1020" font-family="Arial, sans-serif" font-size="18" 
            fill="#FFFFFF" text-anchor="middle" opacity="0.6">
        CloudKitchen Marketing
      </text>
    </svg>`;
  }

    private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  async addQRCode(imageBuffer: Buffer, qrData: string): Promise<Buffer> {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      const qrCodeBuffer = Buffer.from(qrCodeDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');

      return sharp(imageBuffer)
        .composite([
          {
            input: qrCodeBuffer,
            top: 850,
            left: 880,
          },
        ])
        .jpeg({ quality: 95 })
        .toBuffer();
    } catch (error) {
      logger.error('poster', 'Failed to add QR code', { error });
      return imageBuffer;
    }
  }
}