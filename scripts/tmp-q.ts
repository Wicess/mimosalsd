import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
async function main() {
  const p = new PrismaClient()
  for (const [label, where] of [['BLOCKED (CA)', { stateCode: 'CA', productLine: 'VAPE' as const }], ['ALLOWED (TX)', { stateCode: 'TX', productLine: 'VAPE' as const }]] as const) {
    const r = await p.stateRule.findFirst({ where })
    console.log('---', label)
    console.log(JSON.stringify(r, null, 1))
  }
  await p.$disconnect()
}
main()
