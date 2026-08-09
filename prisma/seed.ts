import { PrismaClient } from '@prisma/client';
import { logger } from '../src/lib/logger';
import { serializeJson } from '../src/lib/json';

const prisma = new PrismaClient();

async function main() {
  logger.info('seed', 'Starting database seed...');

  // Create a sample campaign
  const campaign = await prisma.campaign.create({
    data: {
      name: 'Sample Chennai Campaign',
      description: 'Test campaign with sample restaurant leads',
      status: 'draft',
      sheetType: 'google_sheets',
      totalLeads: 3,
    },
  });

  logger.info('seed', 'Created sample campaign', { campaignId: campaign.id });

  // Create sample leads
  const leads = [
    {
      campaignId: campaign.id,
      rawData: serializeJson({
        Name: 'Rahul',
        Restaurant: 'Spice Hub',
        Address: 'Anna Nagar, Chennai',
        Phone: '+919876543210',
        City: 'Chennai',
        'Favorite Item': 'Biryani',
        Offer: 'Flat 25% OFF',
      }) || '{}',
    },
    {
      campaignId: campaign.id,
      rawData: serializeJson({
        Name: 'Priya',
        Restaurant: 'Food Corner',
        Address: 'Velachery, Chennai',
        Phone: '+919988776655',
        City: 'Chennai',
        'Favorite Item': 'Pizza',
        Offer: 'Buy 1 Get 1',
      }) || '{}',
    },
    {
      campaignId: campaign.id,
      rawData: serializeJson({
        Name: 'Arun',
        Restaurant: 'Biryani Palace',
        Address: 'T Nagar, Chennai',
        Phone: '+919912345678',
        City: 'Chennai',
        'Favorite Item': 'Mutton Biryani',
        Offer: 'No Offer',
      }) || '{}',
    },
  ];

  for (const lead of leads) {
    await prisma.lead.create({
      data: lead,
    });
  }

  logger.info('seed', 'Created sample leads', { count: leads.length });

  // Create sample logs
  await prisma.log.createMany({
    data: [
      {
        campaignId: campaign.id,
        level: 'info',
        category: 'system',
        message: 'Database seeded successfully',
        metadata: serializeJson({ campaignName: campaign.name }),
      },
      {
        campaignId: campaign.id,
        level: 'info',
        category: 'sheet',
        message: 'Sample campaign created with 3 leads',
        metadata: serializeJson({ totalLeads: 3 }),
      },
    ],
  });

  logger.info('seed', 'Database seed completed successfully');
}

main()
  .catch((e) => {
    logger.error('seed', 'Seed failed', { error: e });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });