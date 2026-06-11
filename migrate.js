const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  try {
    console.log("Renaming PUBLISHED to AVAILABLE...")
    await prisma.$executeRawUnsafe(`ALTER TYPE "ProductStatus" RENAME VALUE 'PUBLISHED' TO 'AVAILABLE';`)
    console.log("Renamed successfully.")
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log("AVAILABLE already exists.")
    } else {
      console.log("Error renaming PUBLISHED to AVAILABLE: ", e.message)
    }
  }

  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "ProductStatus" ADD VALUE 'RESERVED';`)
    console.log("Added RESERVED.")
  } catch(e) { console.log(e.message) }

  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "ProductStatus" ADD VALUE 'EXPIRED';`)
    console.log("Added EXPIRED.")
  } catch(e) { console.log(e.message) }

  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "ProductStatus" ADD VALUE 'REPUBLISH_PENDING';`)
    console.log("Added REPUBLISH_PENDING.")
  } catch(e) { console.log(e.message) }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
