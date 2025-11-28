// src/bot/lib/prisma.js
import { PrismaClient } from '@prisma/client';

// Bot ALWAYS uses production database so Discord commands appear on live website
// We explicitly use PRODUCTION_DATABASE_URL regardless of how the bot is started
const productionUrl = process.env.PRODUCTION_DATABASE_URL;

if (!productionUrl) {
  throw new Error('PRODUCTION_DATABASE_URL is not set - bot cannot connect to database');
}

console.log('🔌 Bot Database Connection:');
console.log(`   Using: ✅ PRODUCTION_DATABASE_URL (forced)`);
console.log(`   URL contains: ...${productionUrl.substring(40, 60)}...`);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: productionUrl
    }
  }
});

export default prisma;
