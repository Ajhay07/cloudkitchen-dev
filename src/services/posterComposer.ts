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
    // Darkens the top and bottom bands for text legibility while leaving the
    // middle largely clear, so the food photo actually reads as the hero
    // image instead of being flattened under a uniform dark scrim.
    return `<svg width="1080" height="1080">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:rgba(0,0,0,0.85)" />
          <stop offset="22%" style="stop-color:rgba(0,0,0,0.35)" />
          <stop offset="45%" style="stop-color:rgba(0,0,0,0.08)" />
          <stop offset="62%" style="stop-color:rgba(0,0,0,0.12)" />
          <stop offset="80%" style="stop-color:rgba(0,0,0,0.55)" />
          <stop offset="100%" style="stop-color:rgba(0,0,0,0.88)" />
        </linearGradient>
      </defs>
      <rect width="1080" height="1080" fill="url(#grad)" />
    </svg>`;
  }

  /** Maps a theme string to an accent hex color so the frame/ribbon/badge match the poster's palette instead of always being gold. */
  private accentColorForTheme(theme: string): string {
    const t = theme.toLowerCase();
    if (t.includes('neon') || t.includes('cloud kitchen')) return '#22d3ee';
    if (t.includes('red') || t.includes('italian')) return '#ff6b4a';
    if (t.includes('green') || t.includes('banana leaf')) return '#4ade80';
    if (t.includes('pastel') || t.includes('bakery') || t.includes('dessert')) return '#f9a8d4';
    if (t.includes('brown') || t.includes('coffee')) return '#d4a574';
    return '#e8c468';
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
    const frameMargin = 28;
    const maxWidth = this.CANVAS_SIZE - this.SAFE_MARGIN * 2;
    const accent = this.accentColorForTheme(input.theme);

    const businessFit = this.fitText(businessName.toUpperCase(), maxWidth, 2, 46, 28);
    const offerFit = this.fitText(offer, maxWidth - 80, 3, 62, 32);

    // --- Header block: eyebrow badge + business name + divider ---
    const badgeY = 62;
    const businessLineHeight = businessFit.fontSize * 1.18;
    const businessStartY = badgeY + 70;
    const businessBlockEnd = businessStartY + (businessFit.lines.length - 1) * businessLineHeight;
    const customerY = businessBlockEnd + 44;
    const dividerY = customerY + (customerName ? 34 : 6);

    // --- Offer ribbon: a distinct panel so the offer reads as a badge, not floating text ---
    const offerLineHeight = offerFit.fontSize * 1.22;
    const offerPaddingY = 46;
    const offerLabelHeight = 46;
    const offerBlockHeight = offerLabelHeight + offerFit.lines.length * offerLineHeight + offerPaddingY * 2 - offerLineHeight * 0.3;
    const ribbonTop = dividerY + 56;
    const ribbonWidth = Math.min(this.CANVAS_SIZE - frameMargin * 2 - 60, maxWidth + 60);
    const ribbonX = centerX - ribbonWidth / 2;
    const ribbonLabelY = ribbonTop + offerPaddingY;
    const offerStartY = ribbonLabelY + offerLabelHeight;
    const ribbonBottom = ribbonTop + offerBlockHeight;

    // --- Bottom info panel: address/phone/branding on a solid panel for guaranteed contrast ---
    const panelHeight = (address ? 44 : 0) + (phone ? 40 : 0) + 34;
    const panelBottom = this.CANVAS_SIZE - frameMargin - 18;
    const panelTop = panelBottom - panelHeight;
    let infoY = panelTop + 38;

    return `<svg width="${this.CANVAS_SIZE}" height="${this.CANVAS_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.7"/>
        </filter>
      </defs>

      <!-- Decorative outer frame -->
      <rect x="${frameMargin}" y="${frameMargin}" width="${this.CANVAS_SIZE - frameMargin * 2}" height="${this.CANVAS_SIZE - frameMargin * 2}"
            fill="none" stroke="${accent}" stroke-width="2.5" opacity="0.75" rx="14"/>
      <rect x="${frameMargin + 10}" y="${frameMargin + 10}" width="${this.CANVAS_SIZE - (frameMargin + 10) * 2}" height="${this.CANVAS_SIZE - (frameMargin + 10) * 2}"
            fill="none" stroke="${accent}" stroke-width="1" opacity="0.35" rx="8"/>

      <!-- Eyebrow badge -->
      <rect x="${centerX - 110}" y="${badgeY}" width="220" height="34" rx="17" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.9"/>
      <text x="${centerX}" y="${badgeY + 23}" font-family="Arial, sans-serif" font-size="15" font-weight="bold"
            fill="${accent}" text-anchor="middle" letter-spacing="3">EXCLUSIVE OFFER</text>

      <!-- Business Name -->
      ${this.textLines(
        businessFit.lines,
        centerX,
        businessStartY,
        businessLineHeight,
        `font-family="Georgia, 'Times New Roman', serif" font-size="${businessFit.fontSize}" font-weight="bold" fill="#FFFFFF" text-anchor="middle" letter-spacing="1" filter="url(#shadow)"`
      )}

      ${customerName ? `
      <!-- Customer Name -->
      <text x="${centerX}" y="${customerY}" font-family="Arial, sans-serif" font-size="24"
            fill="${accent}" text-anchor="middle" opacity="0.95">
        For ${this.escapeXml(customerName)}
      </text>
      ` : ''}

      <!-- Divider -->
      <line x1="${centerX - 70}" y1="${dividerY}" x2="${centerX + 70}" y2="${dividerY}" stroke="${accent}" stroke-width="2" opacity="0.7"/>
      <circle cx="${centerX}" cy="${dividerY}" r="4" fill="${accent}"/>

      <!-- Offer ribbon panel -->
      <rect x="${ribbonX}" y="${ribbonTop}" width="${ribbonWidth}" height="${ribbonBottom - ribbonTop}" rx="18"
            fill="rgba(8,8,8,0.62)" stroke="${accent}" stroke-width="1.5" opacity="0.96"/>
      <text x="${centerX}" y="${ribbonLabelY}" font-family="Arial, sans-serif" font-size="22" font-weight="bold"
            fill="${accent}" text-anchor="middle" letter-spacing="4">SPECIAL OFFER FOR YOU</text>
      ${this.textLines(
        offerFit.lines,
        centerX,
        offerStartY,
        offerLineHeight,
        `font-family="Georgia, 'Times New Roman', serif" font-size="${offerFit.fontSize}" font-weight="bold" fill="#FFFFFF" text-anchor="middle" filter="url(#shadow)"`
      )}

      <!-- Bottom info panel -->
      ${(address || phone) ? `
      <rect x="${frameMargin + 26}" y="${panelTop}" width="${this.CANVAS_SIZE - (frameMargin + 26) * 2}" height="${panelHeight}" rx="12"
            fill="rgba(0,0,0,0.55)"/>
      ${address ? `<text x="${centerX}" y="${infoY}" font-family="Arial, sans-serif" font-size="21" fill="#FFFFFF" text-anchor="middle" opacity="0.95">${this.escapeXml(this.fitText(address, maxWidth - 40, 1, 21, 16).lines[0])}</text>` : ''}
      ${phone ? `<text x="${centerX}" y="${infoY + (address ? 40 : 0)}" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="${accent}" text-anchor="middle">${this.escapeXml(phone)}</text>` : ''}
      ` : ''}

      <!-- Branding -->
      <text x="${centerX}" y="${this.CANVAS_SIZE - frameMargin + 6}" font-family="Arial, sans-serif" font-size="14"
            fill="#FFFFFF" text-anchor="middle" opacity="0.5" letter-spacing="1">CLOUDKITCHEN MARKETING</text>
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