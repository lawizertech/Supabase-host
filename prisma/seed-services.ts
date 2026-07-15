import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const FE_DIR = '/Users/suvanghosh/LawizerFE';
const dbUrl = process.env.DATABASE_URL!;

if (!dbUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const serviceFiles = [
  { path: 'lib/data/services/banking.ts', category: 'banking' },
  { path: 'lib/data/services/itr.ts', category: 'itr' },
  { path: 'lib/data/services/property/drafting.ts', category: 'property-drafting' },
  { path: 'lib/data/services/property/registration.ts', category: 'property-registration' },
  { path: 'lib/data/services/property/verify.ts', category: 'property-verify' },
  { path: 'lib/data/services/startup-businesslegal/growbusiness.ts', category: 'business-grow' },
  { path: 'lib/data/services/startup-businesslegal/managebusiness.ts', category: 'business-manage' },
  { path: 'lib/data/services/startup-businesslegal/protectbusiness.ts', category: 'business-protect' },
  { path: 'lib/data/services/startup-businesslegal/startbusiness.ts', category: 'business-start' }
];

const docFile = 'app/(services)/documentation/data/documentation.json';

function parseTypeScriptFile(filePath: string): any {
  let content = fs.readFileSync(filePath, 'utf-8');
  // Strip imports
  content = content.replace(/import\s+[^;]+;/g, '');
  // Strip TypeScript types
  content = content.replace(/:\s*Record<[^>]+>/g, '');
  content = content.replace(/:\s*ServiceData/g, '');
  content = content.replace(/satisfies\s+[A-Za-z0-9\[\]]+/g, '');
  // Replace export
  content = content.replace(/export\s+const\s+servicesData\s*=/, 'const servicesData =');
  // Add module export
  content += '\nmodule.exports = servicesData;';
  
  // Create a temporary file and require it
  const tempFile = path.join(__dirname, 'temp_eval.js');
  fs.writeFileSync(tempFile, content, 'utf-8');
  delete require.cache[require.resolve(tempFile)];
  const data = require(tempFile);
  fs.unlinkSync(tempFile);
  return data;
}

async function seed() {
  console.log("Starting DB seeding...");

  // 1. Process regular services from TS files
  for (const fileObj of serviceFiles) {
    const fullPath = path.join(FE_DIR, fileObj.path);
    console.log(`Processing file: ${fileObj.path}`);
    try {
      const data = parseTypeScriptFile(fullPath);
      for (const slug in data) {
        const item = data[slug];
        if (!item.serviceID) continue;
        
        console.log(`Upserting service: ${item.serviceID} (${item.title})`);
        await prisma.services.upsert({
          where: { service_id: item.serviceID },
          update: {
            title: item.title,
            subtitle: item.subtitle,
            badge_text: item.badgeText,
            icon: item.icon,
            content_title: item.contentTitle,
            content_description: item.contentDescription,
            section1_title: item.section1Title,
            price: Number(item.price),
            original_price: Number(item.originalPrice),
            theme: item.theme || {},
            benefits: item.benefits || [],
            faqs: item.faqs || [],
            sections: item.sections || [],
            addons: item.addons || [],
            category: fileObj.category,
            is_active: true,
          },
          create: {
            id: slug,
            service_id: item.serviceID,
            title: item.title,
            subtitle: item.subtitle,
            badge_text: item.badgeText,
            icon: item.icon,
            content_title: item.contentTitle,
            content_description: item.contentDescription,
            section1_title: item.section1Title,
            price: Number(item.price),
            original_price: Number(item.originalPrice),
            theme: item.theme || {},
            benefits: item.benefits || [],
            faqs: item.faqs || [],
            sections: item.sections || [],
            addons: item.addons || [],
            category: fileObj.category,
            is_active: true,
          }
        });
      }
    } catch (e) {
      console.error(`Error parsing ${fileObj.path}:`, e);
    }
  }

  // 2. Process documentation services from JSON
  const docPath = path.join(FE_DIR, docFile);
  console.log(`Processing documentation JSON file: ${docFile}`);
  try {
    const docData = JSON.parse(fs.readFileSync(docPath, 'utf-8'));
    for (const item of docData) {
      const serviceID = item.layout?.serviceID;
      if (!serviceID) continue;

      const price = Number(item.hero?.price?.replace(/[^0-9]/g, '')) || 999;
      const originalPrice = Number(item.hero?.originalPrice?.replace(/[^0-9]/g, '')) || 0;

      console.log(`Upserting documentation service: ${serviceID} (${item.title})`);
      await prisma.services.upsert({
        where: { service_id: serviceID },
        update: {
          title: item.title,
          subtitle: item.hero?.subtitle,
          badge_text: item.hero?.badge,
          icon: item.layout?.icon,
          content_title: item.layout?.contentTitle,
          content_description: item.layout?.contentDescription,
          section1_title: item.layout?.section1Title,
          price: price,
          original_price: originalPrice,
          theme: item.theme || {},
          benefits: item.benefits || [],
          faqs: item.faqs || [],
          sections: item.sections || [],
          addons: item.hero?.addons?.map((a: any) => a.label) || [],
          category: 'documentation',
          is_active: true,
        },
        create: {
          id: item.slug,
          service_id: serviceID,
          title: item.title,
          subtitle: item.hero?.subtitle,
          badge_text: item.hero?.badge,
          icon: item.layout?.icon,
          content_title: item.layout?.contentTitle,
          content_description: item.layout?.contentDescription,
          section1_title: item.layout?.section1Title,
          price: price,
          original_price: originalPrice,
          theme: item.theme || {},
          benefits: item.benefits || [],
          faqs: item.faqs || [],
          sections: item.sections || [],
          addons: item.hero?.addons?.map((a: any) => a.label) || [],
          category: 'documentation',
          is_active: true,
        }
      });
    }
  } catch (e) {
    console.error("Error parsing documentation JSON:", e);
  }

  // 3. Process business partnership agreement (manual page in LawizerFE)
  // We can insert it directly since it is hardcoded in the frontend
  console.log("Upserting manual business partnership agreement service...");
  await prisma.services.upsert({
    where: { service_id: "BUSINESS_PARTNERSHIP_AGREEMENT_DRAFTING" },
    update: {
      title: "Business Partnership Agreement Drafting",
      subtitle: "A legally enforceable agreement defining investment, profit-sharing, roles, and exit mechanisms among partners.",
      badge_text: "Custom-drafted • Legally enforceable • Dispute-proof",
      icon: "users",
      content_title: "Why a Business Partnership Agreement Is Essential",
      content_description: "A well-drafted partnership agreement is the foundation of a stable business relationship. It clearly documents expectations, prevents misunderstandings, and safeguards the interests of all partners from day one.",
      section1_title: "Key Protections & Benefits",
      price: 1499,
      original_price: 4499,
      theme: { orb1: "bg-orange-500/20", orb2: "bg-yellow-500/20", iconBg: "from-orange-500 to-yellow-500", badgeText: "text-yellow-300" },
      category: 'documentation',
      is_active: true,
    },
    create: {
      id: "business-partnership-agreement1",
      service_id: "BUSINESS_PARTNERSHIP_AGREEMENT_DRAFTING",
      title: "Business Partnership Agreement Drafting",
      subtitle: "A legally enforceable agreement defining investment, profit-sharing, roles, and exit mechanisms among partners.",
      badge_text: "Custom-drafted • Legally enforceable • Dispute-proof",
      icon: "users",
      content_title: "Why a Business Partnership Agreement Is Essential",
      content_description: "A well-drafted partnership agreement is the foundation of a stable business relationship. It clearly documents expectations, prevents misunderstandings, and safeguards the interests of all partners from day one.",
      section1_title: "Key Protections & Benefits",
      price: 1499,
      original_price: 4499,
      theme: { orb1: "bg-orange-500/20", orb2: "bg-yellow-500/20", iconBg: "from-orange-500 to-yellow-500", badgeText: "text-yellow-300" },
      category: 'documentation',
      is_active: true,
    }
  });

  console.log("DB seeding completed successfully!");
}

seed()
  .catch(err => console.error(err))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
