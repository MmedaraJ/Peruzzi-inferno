import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

for (const p of [path.join(process.cwd(), '.env'), path.join(__dirname, '../../.env')]) if (fs.existsSync(p)) { try { (process as any).loadEnvFile(p); } catch {} break; }

/** Settings are read with their defaults filled in at runtime (src/common/config.service.ts), so a fresh database
 *  needs no rows at all. The seed only says how many have been saved; it exists so the start command stays the same as
 *  the other projects. */
async function main() {
  const prisma = new PrismaClient();
  const n = await prisma.config.count();
  console.log(`seed: ${n} saved settings; defaults fill in the rest`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
