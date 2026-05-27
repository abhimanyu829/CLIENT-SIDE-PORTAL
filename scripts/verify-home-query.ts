import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const products = await prisma.product.findMany({
    take: 1,
    include: {
      tiers: {
        take: 1,
        orderBy: { price: "asc" },
      },
    },
  })

  console.log(`product query ok: ${products.length}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
