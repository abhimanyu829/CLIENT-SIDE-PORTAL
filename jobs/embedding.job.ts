import { Worker, Job } from "bullmq"
import { generateEmbedding } from "@/lib/openai"
import { db } from "@/lib/db"

const queueName = "embedding-queue"

export const embeddingWorkerOptions = {
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
  },
  concurrency: 5,
}

export const worker = new Worker(
  queueName,
  async (job: Job) => {
    const { type, id, content } = job.data
    
    try {
      const vector = await generateEmbedding(content)
      
      if (type === 'product') {
        // Must format array for pgvector
        const formattedVector = `[${vector.join(',')}]`
        await db.$executeRaw`
          UPDATE "Product" 
          SET embedding = ${formattedVector}::vector 
          WHERE id = ${id}
        `
      } else if (type === 'user_profile') {
        const formattedVector = `[${vector.join(',')}]`
        await db.$executeRaw`
          UPDATE "User" 
          SET "interestVector" = ${formattedVector}::vector 
          WHERE id = ${id}
        `
      }
      
      return { success: true }
    } catch (error) {
      console.error(`[Embedding Job] Failed to process ${type} ${id}:`, error)
      throw error
    }
  },
  embeddingWorkerOptions
)

worker.on('completed', job => {
  console.log(`[Job ${job.id}] completed!`);
})

worker.on('failed', (job, err) => {
  console.error(`[Job ${job?.id}] failed with ${err.message}`);
})
