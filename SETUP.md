# CloudKitchen Dev - Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd cloudkitchen-dev
npm install
```

### 2. Configure Environment

```bash
# Copy the example environment file
copy .env.example .env.local

# Edit .env.local with your API keys
notepad .env.local
```

Required environment variables:
- `OPENAI_API_KEY` - Get from https://platform.openai.com/api-keys
- `META_WHATSAPP_TOKEN` - Get from Meta Developer Console
- `META_WHATSAPP_PHONE_NUMBER_ID` - Get from Meta Developer Console
- `DATABASE_URL` - Use `file:./dev.db` for SQLite

Optional (for additional features):
- `OPENAI_IMAGE_API_KEY` - For DALL-E image generation
- `STABILITY_AI_API_KEY` - For Stability AI images
- `FAL_API_KEY` - For FAL image generation
- `REPLICATE_API_TOKEN` - For Replicate image generation
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` - For Twilio WhatsApp

### 3. Set Up Database

```bash
# Generate Prisma client
npm run db:generate

# Create and migrate database
npm run db:push

# Optional: Seed with sample data
npm run db:seed
```

### 4. Start Redis

Make sure Redis is running on localhost:6379 (default).

**Windows:**
- Download from https://github.com/microsoftarchive/redis/releases
- Or use WSL: `sudo service redis-server start`

**Mac:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo systemctl start redis
```

### 5. Run the Application

Open two terminals:

**Terminal 1 - Next.js Server:**
```bash
npm run dev
```
Access dashboard at: http://localhost:3000

**Terminal 2 - Worker:**
```bash
npm run worker
```

## First Campaign

1. Open http://localhost:3000
2. Enter a campaign name
3. Upload a Google Sheet URL or Excel/CSV file
4. Click "Create Campaign"
5. Click "Start" to begin processing
6. Monitor progress in the dashboard

## Sheet Format

The system automatically detects columns. Example formats:

**Format 1:**
```
Name	Restaurant	Address	Phone	City	Favorite Item	Offer
Rahul	Spice Hub	Anna Nagar	+919876543210	Chennai	Biryani	Flat 25% OFF
```

**Format 2:**
```
Customer Name	Company	Email	Phone	Owner	GST	Location	Branch
```

The AI will intelligently map columns to the correct fields.

## Troubleshooting

### TypeScript Errors in IDE
These are expected until dependencies are fully installed. Run `npm install` and the errors will resolve.

### Redis Connection Error
Make sure Redis is running:
```bash
# Test Redis connection
redis-cli ping
# Should return: PONG
```

### OpenAI API Errors
Verify your API key is correctly set in `.env.local` and has available credits.

### Prisma Errors
Regenerate the Prisma client:
```bash
npm run db:generate
```

## Project Structure

```
cloudkitchen-dev/
├── src/
│   ├── app/
│   │   ├── api/                    # API routes
│   │   │   └── campaigns/
│   │   │       ├── route.ts
│   │   │       └── [id]/
│   │   │           ├── route.ts
│   │   │           ├── leads/
│   │   │           ├── posters/
│   │   │           └── logs/
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Dashboard
│   │   └── globals.css
│   ├── lib/
│   │   ├── prisma.ts
│   │   └── logger.ts
│   ├── services/
│   │   ├── sheetReader.ts
│   │   ├── columnMapper.ts
│   │   ├── posterPromptGenerator.ts
│   │   ├── imageGenerator.ts
│   │   ├── posterComposer.ts
│   │   ├── whatsappSender.ts
│   │   └── queue.ts
│   └── workers/
│       └── processor.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── uploads/                       # Generated posters
├── package.json
└── README.md
```

## Next Steps

1. Add your API keys to `.env.local`
2. Start Redis
3. Run `npm run dev` and `npm run worker`
4. Create your first campaign
5. Monitor processing in the dashboard

For production deployment, see README.md.