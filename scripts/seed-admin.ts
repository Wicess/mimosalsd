#!/usr/bin/env tsx
/** Create or update an admin user. `npm run admin:user -- <email> <password> <role> [areas,csv]` */
import 'dotenv/config'
import { db } from '../src/lib/db/client'
import { hashPassword } from '../src/lib/admin/password'
import { ADMIN_AREA_SLUGS } from '../src/lib/admin/areas'

async function main() {
  const [email, password, role = 'STAFF', areasCsv = ''] = process.argv.slice(2)
  if (!email || !password || password.length < 12) {
    console.error('Usage: npm run admin:user -- <email> <password(12+)> <SUPERADMIN|ADMIN|STAFF> [areas,csv]')
    process.exit(1)
  }
  if (!['SUPERADMIN', 'ADMIN', 'STAFF'].includes(role)) {
    console.error(`Unknown role "${role}".`)
    process.exit(1)
  }

  const areas = areasCsv.split(',').map((a) => a.trim()).filter(Boolean)
  const unknown = areas.filter((a) => !ADMIN_AREA_SLUGS.includes(a))
  if (unknown.length > 0) {
    console.error(`Unknown areas: ${unknown.join(', ')}`)
    console.error(`Valid: ${ADMIN_AREA_SLUGS.join(', ')}`)
    process.exit(1)
  }

  const user = await db.adminUser.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash: hashPassword(password), role: role as never, adminAreas: areas, isActive: true },
    create: {
      email: email.toLowerCase(),
      name: email.split('@')[0] ?? 'Operator',
      passwordHash: hashPassword(password),
      role: role as never,
      adminAreas: areas,
    },
  })
  console.log(`✓ ${user.email} — ${user.role}${areas.length ? ` [${areas.join(', ')}]` : ''}`)
  await db.$disconnect()
}

main().catch((e: Error) => { console.error(e.message); process.exit(1) })
