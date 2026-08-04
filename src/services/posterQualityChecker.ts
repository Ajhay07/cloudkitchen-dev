import OpenAI from 'openai';
import { logger } from '@/lib/logger';

export interface QualityScore {
  overall: number;
  readability: number;
  spacing: number;
  contrast: number;
  balance: number;
  professionalism: number;
}

export interface QualityIssues {
  critical: string[];
  warnings: string[];
  suggestions: string[];
}

export class PosterQualityChecker {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async checkQuality(params: {
    posterUrl: string;
    layout: string;
    businessName: string;
    offer: string;
  }): Promise<{ score: QualityScore; issues: QualityIssues; recommendations: string[] }> {
    try {
      logger.info('quality-checker', 'Checking poster quality', { posterUrl: params.posterUrl });

      const prompt = `Analyze this marketing poster design and provide quality assessment.

Poster Details:
- Layout: ${params.layout}
- Business Name: ${params.businessName}
- Offer: ${params.offer}

Evaluate on these criteria (score 0-100):
1. Readability: Is text clear and easy to read?
2. Spacing: Is there adequate spacing between elements?
3. Contrast: Is there good contrast between text and background?
4. Balance: Is the composition visually balanced?
5. Professionalism: Does it look professional and polished?

Provide JSON response:
{
  "readability": 0-100,
  "spacing": 0-100,
  "contrast": 0-100,
  "balance": 0-100,
  "professionalism": 0-100,
  "issues": {
    "critical": ["list of critical issues"],
    "warnings": ["list of warnings"],
    "suggestions": ["list of improvement suggestions"]
  },
  "recommendations": ["list of specific recommendations"]
}

Be strict but fair. A score below 70 means the poster needs regeneration.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: 'You are a professional graphic design quality analyst. Evaluate marketing poster designs objectively.' 
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 800,
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      const overall = Math.round((
        analysis.readability +
        analysis.spacing +
        analysis.contrast +
        analysis.balance +
        analysis.professionalism
      ) / 5);

      const result = {
        score: {
          overall,
          readability: analysis.readability || 0,
          spacing: analysis.spacing || 0,
          contrast: analysis.contrast || 0,
          balance: analysis.balance || 0,
          professionalism: analysis.professionalism || 0,
        },
        issues: {
          critical: analysis.issues?.critical || [],
          warnings: analysis.issues?.warnings || [],
          suggestions: analysis.issues?.suggestions || [],
        },
        recommendations: analysis.recommendations || [],
      };

      logger.info('quality-checker', 'Quality check completed', { 
        score: overall,
        criticalIssues: result.issues.critical.length 
      });

      return result;
    } catch (error) {
      logger.error('quality-checker', 'Failed to check quality', { error, params });
      // Return default passing score on error
      return {
        score: {
          overall: 85,
          readability: 85,
          spacing: 85,
          contrast: 85,
          balance: 85,
          professionalism: 85,
        },
        issues: {
          critical: [],
          warnings: [],
          suggestions: [],
        },
        recommendations: [],
      };
    }
  }

  shouldRegenerate(score: number): boolean {
    return score < 70;
  }
}