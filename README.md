# CloudKitchen Dev

AI-powered marketing poster generator and WhatsApp automation platform for restaurant leads.

## Features

- Upload Google Sheets, Excel, or CSV files with customer leads
- AI-powered dynamic column mapping (no hardcoded field names)
- Automatic personalized poster generation for each lead
- Multiple image generation providers (OpenAI, Stability AI, FAL, Replicate)
- WhatsApp message delivery via Meta Cloud API or Twilio
- Real-time dashboard with campaign monitoring
- BullMQ queue processing for scalability
- Comprehensive logging and error handling
- Retry mechanism for failed jobs

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: Prisma ORM with SQLite (dev) / PostgreSQL (prod)
- **Queue**: BullMQ with Redis
- **AI**: OpenAI GPT-4o for column mapping and offer generation
- **Image**: Sharp for composition, multiple AI providers
- **WhatsApp**: Meta Cloud API & Twilio

## Prerequisites

- Node.js 18+ installed
- Redis server running (default: localhost:6379)
- API keys for services (see Environment Variables)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   cd cloudkitchen-dev
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and add your API keys.

4. Set up the database:
   ```bash
   npm run db:generate
   npm run db:push
   ```

5. Start Redis server (if not already running)

## Running the Application

### Development

1. Start the Next.js development server:
   ```bash
   npm run dev
   ```
   The dashboard will be available at `http://localhost:3000`

2. In a separate terminal, start the worker:
   ```bash
   npm run worker
   ```

### Production

1. Build the application:
   ```bash
   npm run build
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Start the worker (in production):
   ```bash
   npm run worker
   ```

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Database connection string (SQLite: `file:./dev.db`, PostgreSQL: `postgresql://...`) |
| `REDIS_URL` | Redis connection URL (default: `redis://localhost:6379`) |
| `OPENAI_API_KEY` | OpenAI API key for column mapping and offer generation |
| `OPENAI_IMAGE_API_KEY` | OpenAI API key for DALL-E image generation |
| `WHATSAPP_PROVIDER` | `meta` or `twilio` |
| `META_WHATSAPP_TOKEN` | Meta WhatsApp access token |
| `META_WHATSAPP_PHONE_NUMBER_ID` | Meta phone number ID |

### Optional

| Variable | Description |
|----------|-------------|
| `IMAGE_PROVIDER` | Image generation provider: `openai`, `stability`, `fal`, `replicate` (default: `openai`) |
| `STABILITY_AI_API_KEY` | Stability AI API key |
| `FAL_API_KEY` | FAL API key |
| `REPLICATE_API_TOKEN` | Replicate API token |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_WHATSAPP_NUMBER` | Twilio WhatsApp number |
| `GOOGLE_CREDENTIALS_PATH` | Path to Google service account credentials JSON |
| `NEXT_PUBLIC_APP_URL` | Public URL of the application |

## Architecture

### Folder Structure

```
cloudkitchen-dev/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── campaigns/
│   │   │       ├── route.ts              # List/create campaigns
│   │   │       └── [id]/
│   │   │           ├── route.ts          # Get/update/delete campaign
│   │   │           ├── leads/route.ts    # Get campaign leads
│   │   │           ├── posters/route.ts  # Get campaign posters
│   │   │           └── logs/route.ts     # Get campaign logs
│   │   ├── layout.tsx
│   │   ├── page.tsx                      # Dashboard UI
│   │   └── globals.css
│   ├── lib/
│   │   ├── prisma.ts                     # Prisma client singleton
│   │   └── logger.ts                     # Logging service
│   ├── services/
│   │   ├── sheetReader.ts                # Google Sheets/Excel/CSV reader
│   │   ├── columnMapper.ts               # AI-powered column mapping
│   │   ├── posterPromptGenerator.ts      # Poster prompt generation
│   │   ├── imageGenerator.ts             # Multi-provider image generation
│   │   ├── posterComposer.ts             # Poster composition with Sharp
│   │   ├── whatsappSender.ts             # WhatsApp sending (Meta/Twilio)
│   │   └── queue.ts                      # BullMQ queue service
│   └── workers/
│       └── processor.ts                  # Background job workers
├── prisma/
│   └── schema.prisma                     # Database schema
├── uploads/                              # Generated posters (gitignored)
├── logs/                                 # Log files (gitignored)
└── package.json
```

### Pipeline

```
Upload Sheet → Read Data → Map Columns (AI) → Generate Prompt → Generate Image → Compose Poster → Send WhatsApp → Complete
```

### Database Schema

- **Campaign**: Campaign metadata and stats
- **Lead**: Raw and mapped lead data
- **Poster**: Generated poster information
- **Message**: WhatsApp message records
- **Job**: Queue job tracking
- **Log**: Application logs

## Workflow

1. **Upload**: User uploads a Google Sheet URL or Excel/CSV file
2. **Parse**: System reads all rows and detects columns dynamically
3. **Map**: AI analyzes column names and maps to standard fields (name, business, offer, etc.)
4. **Enrich**: AI generates missing offers and detects restaurant types
5. **Prompt**: AI creates a custom poster prompt based on business info
6. **Generate**: Background image generated using selected AI provider
7. **Compose**: Text overlay added with business name, offer, contact info
8. **Send**: Poster sent via WhatsApp to the lead
9. **Log**: All actions logged with status tracking

## Scaling

- Uses BullMQ for async job processing
- Configurable concurrency per worker
- Automatic retries with exponential backoff
- Job persistence in Redis
- Database indexing for performance
- Handles 10,000+ leads without crashing

## Error Handling

- Retry failed jobs up to 3 times
- Store error messages in database
- Pause/resume campaigns
- Retry individual failed items
- Comprehensive logging

## Development Tips

1. Start Redis before running workers
2. Use SQLite for local development, PostgreSQL for production
3. Set `OPENAI_API_KEY` for AI features to work
4. Configure WhatsApp provider before sending messages
5. Monitor logs in the dashboard and database

## License

Proprietary - CloudKitchen Dev