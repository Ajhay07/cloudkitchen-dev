import OpenAI from 'openai';
import { logger } from '@/lib/logger';

export type ImageProvider = 'openai' | 'gemini' | 'stability' | 'fal' | 'replicate';

export interface GeneratedImage {
  url: string;
  provider: ImageProvider;
  prompt: string;
}

export class ImageGenerator {
  private provider: ImageProvider;
  private openai: OpenAI;

  constructor() {
    this.provider = (process.env.IMAGE_PROVIDER as ImageProvider) || 'openai';
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_IMAGE_API_KEY || process.env.OPENAI_API_KEY,
    });
  }

  async generateImage(prompt: string, size: string = '1024x1024'): Promise<GeneratedImage> {
    try {
      logger.info('image', `Generating image with provider: ${this.provider}`, { prompt: prompt.substring(0, 100) });

      switch (this.provider) {
        case 'openai':
          return this.generateWithOpenAI(prompt, size);
        case 'stability':
          return this.generateWithStability(prompt, size);
        case 'fal':
          return this.generateWithFal(prompt, size);
        case 'replicate':
          return this.generateWithReplicate(prompt, size);
        default:
          return this.generateWithOpenAI(prompt, size);
      }
    } catch (error) {
      logger.error('image', 'Failed to generate image', { error, provider: this.provider });
      throw error;
    }
  }

  private async generateWithOpenAI(prompt: string, size: string): Promise<GeneratedImage> {
    try {
      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: size as '1024x1024' | '1792x1024' | '1024x1792',
        quality: 'standard',
        style: 'vivid',
      });

      const url = response.data[0].url!;
      logger.info('image', 'Image generated with OpenAI', { url });

      return {
        url,
        provider: 'openai',
        prompt,
      };
    } catch (error) {
      logger.error('image', 'OpenAI image generation failed', { error });
      throw error;
    }
  }

  private async generateWithStability(prompt: string, size: string): Promise<GeneratedImage> {
    try {
      const apiKey = process.env.STABILITY_AI_API_KEY;
      if (!apiKey) throw new Error('Stability AI API key not configured');

      const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          text_prompts: [{ text: prompt }],
          cfg_scale: 7,
          height: 1024,
          width: 1024,
          steps: 30,
          samples: 1,
        }),
      });

      const data = await response.json();
      const base64Image = data.artifacts[0].base64;
      const url = `data:image/png;base64,${base64Image}`;

      logger.info('image', 'Image generated with Stability AI');

      return {
        url,
        provider: 'stability',
        prompt,
      };
    } catch (error) {
      logger.error('image', 'Stability AI image generation failed', { error });
      throw error;
    }
  }

  private async generateWithFal(prompt: string, size: string): Promise<GeneratedImage> {
    try {
      const apiKey = process.env.FAL_API_KEY;
      if (!apiKey) throw new Error('FAL API key not configured');

      const response = await fetch('https://fal.run/fal-ai/stable-diffusion/v3-medium', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Key ${apiKey}`,
        },
        body: JSON.stringify({
          prompt,
          image_size: 'square',
          num_inference_steps: 28,
          guidance_scale: 7.5,
        }),
      });

      const data = await response.json();
      const url = data.images[0].url;

      logger.info('image', 'Image generated with FAL');

      return {
        url,
        provider: 'fal',
        prompt,
      };
    } catch (error) {
      logger.error('image', 'FAL image generation failed', { error });
      throw error;
    }
  }

  private async generateWithReplicate(prompt: string, size: string): Promise<GeneratedImage> {
    try {
      const apiToken = process.env.REPLICATE_API_TOKEN;
      if (!apiToken) throw new Error('Replicate API token not configured');

      const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${apiToken}`,
        },
        body: JSON.stringify({
          version: 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
          input: {
            prompt,
            width: 1024,
            height: 1024,
            num_inference_steps: 25,
          },
        }),
      });

      const prediction = await response.json();
      
      // Poll for completion
      let result = prediction;
      while (result.status !== 'succeeded' && result.status !== 'failed') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const pollResponse = await fetch(result.urls.get, {
          headers: { 'Authorization': `Token ${apiToken}` },
        });
        result = await pollResponse.json();
      }

      if (result.status === 'failed') {
        throw new Error('Replicate prediction failed');
      }

      const url = result.output[0];
      logger.info('image', 'Image generated with Replicate');

      return {
        url,
        provider: 'replicate',
        prompt,
      };
    } catch (error) {
      logger.error('image', 'Replicate image generation failed', { error });
      throw error;
    }
  }

  getProvider(): ImageProvider {
    return this.provider;
  }

  setProvider(provider: ImageProvider) {
    this.provider = provider;
    logger.info('image', `Image provider changed to: ${provider}`);
  }
}