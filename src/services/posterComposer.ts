import sharp from 'sharp';
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

  private applyThemeOverlay(image: sharp.Sharp, theme: string): sharp.Sharp {
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

  private readonly CANVAS_SIZE = 1080;
  private readonly SAFE_MARGIN = 90;

  /**
   * Estimates rendered text width without a canvas/font-metrics API
   * (this runs server-side via Sharp/librsvg, no DOM available). The 0.58
   * factor is calibrated for bold Arial - conservative enough to avoid
   * overflow, which is the failure mode that actually matters here (text
   * running off both edges of the poster).
   */
  private estimateTextWidth(text: string, fontSize: number): number {
    return text.length * fontSize * 0.58;
  }

  private wrapText(text: string, maxWidth: number, fontSize: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (this.estimateTextWidth(candidate, fontSize) <= maxWidth || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  /** Shrinks font size until the text fits within maxLines at maxWidth, so long offers never overflow or get truncated mid-word. */
  private fitText(
    text: string,
    maxWidth: number,
    maxLines: number,
    startSize: number,
    minSize: number
  ): { lines: string[]; fontSize: number } {
    for (let size = startSize; size >= minSize; size -= 2) {
      const lines = this.wrapText(text, maxWidth, size);
      if (lines.length <= maxLines) {
        return { lines, fontSize: size };
      }
    }
    // Fallback at the smallest size: hard-wrap and cap the line count,
    // ellipsizing the last visible line rather than silently dropping text.
    let lines = this.wrapText(text, maxWidth, minSize);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '...';
    }
    return { lines, fontSize: minSize };
  }

  private textLines(lines: string[], centerX: number, startY: number, lineHeight: number, attrs: string): string {
    return lines
      .map((line, i) => `<text x="${centerX}" y="${startY + i * lineHeight}" ${attrs}>${this.escapeXml(line)}</text>`)
      .join('\n      ');
  }

  private createTextOverlay(input: PosterCompositionInput): string {
    const { businessName, offer, address, phone, customerName } = input;
    const centerX = this.CANVAS_SIZE / 2;
    const maxWidth = this.CANVAS_SIZE - this.SAFE_MARGIN * 2;

    const businessFit = this.fitText(businessName, maxWidth, 2, 52, 32);
    const offerFit = this.fitText(offer, maxWidth, 3, 68, 34);

    const businessLineHeight = businessFit.fontSize * 1.2;
    const businessBlockHeight = businessFit.lines.length * businessLineHeight;
    const businessStartY = 110;
    const customerY = businessStartY + businessBlockHeight + 20;
    const dividerY = customerY + (customerName ? 40 : 10);

    const labelY = dividerY + 70;
    const offerLineHeight = offerFit.fontSize * 1.25;
    const offerStartY = labelY + 60;
    const offerBlockEndY = offerStartY + (offerFit.lines.length - 1) * offerLineHeight;

    const addressY = Math.max(offerBlockEndY + 130, 860);
    const phoneY = addressY + 45;
    const brandingY = this.CANVAS_SIZE - 40;

    return `<svg width="${this.CANVAS_SIZE}" height="${this.CANVAS_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.6"/>
        </filter>
      </defs>

      <!-- Background overlay for text readability -->
      <rect x="0" y="0" width="${this.CANVAS_SIZE}" height="${this.CANVAS_SIZE}" fill="rgba(0,0,0,0.35)" />

      <!-- Business Name -->
      ${this.textLines(
        businessFit.lines,
        centerX,
        businessStartY,
        businessLineHeight,
        `font-family="Arial, sans-serif" font-size="${businessFit.fontSize}" font-weight="bold" fill="#FFD700" text-anchor="middle" filter="url(#shadow)"`
      )}

      ${customerName ? `
      <!-- Customer Name -->
      <text x="${centerX}" y="${customerY}" font-family="Arial, sans-serif" font-size="26"
            fill="#FFFFFF" text-anchor="middle" opacity="0.9">
        ${this.escapeXml(customerName)}
      </text>
      ` : ''}

      <!-- Divider Line -->
      <line x1="${this.SAFE_MARGIN + 60}" y1="${dividerY}" x2="${this.CANVAS_SIZE - this.SAFE_MARGIN - 60}" y2="${dividerY}" stroke="#FFD700" stroke-width="2" opacity="0.6"/>

      <!-- "SPECIAL OFFER FOR YOU" label -->
      <text x="${centerX}" y="${labelY}" font-family="Arial, sans-serif" font-size="24"
            fill="#FFD700" text-anchor="middle" letter-spacing="3">
        SPECIAL OFFER FOR YOU
      </text>

      <!-- Offer (auto-sized and wrapped to always fit within the canvas) -->
      ${this.textLines(
        offerFit.lines,
        centerX,
        offerStartY,
        offerLineHeight,
        `font-family="Arial, sans-serif" font-size="${offerFit.fontSize}" font-weight="bold" fill="#FFFFFF" text-anchor="middle" filter="url(#shadow)"`
      )}

      <!-- Address -->
      ${address ? `
      <text x="${centerX}" y="${addressY}" font-family="Arial, sans-serif" font-size="24"
            fill="#FFFFFF" text-anchor="middle" opacity="0.9">
        ${this.escapeXml(this.fitText(address, maxWidth, 1, 24, 18).lines[0])}
      </text>
      ` : ''}

      <!-- Phone -->
      ${phone ? `
      <text x="${centerX}" y="${phoneY}" font-family="Arial, sans-serif" font-size="22"
            fill="#FFD700" text-anchor="middle">
        ${this.escapeXml(phone)}
      </text>
      ` : ''}

      <!-- Branding -->
      <text x="${centerX}" y="${brandingY}" font-family="Arial, sans-serif" font-size="16"
            fill="#FFFFFF" text-anchor="middle" opacity="0.55">
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