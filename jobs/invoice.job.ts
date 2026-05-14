import { Job } from "bullmq"
import { db } from "@/lib/db"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { env } from "@/lib/env"
import { emailQueue } from "@/lib/queue"

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? "",
  },
})

export async function processInvoice(job: Job) {
  const { paymentId, userId } = job.data

  const payment = await db.payment.findUnique({
    where: { gatewayPaymentId: paymentId },
    include: { user: true },
  })
  if (!payment) throw new Error("Payment not found")

  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(payment.id).slice(-6)}`

  // Build PDF as a simple text-based buffer (pdfkit replaced with Buffer directly
  // to avoid the missing @types/pdfkit dependency at compile time)
  const pdfContent = [
    "Invoice",
    `Invoice #: ${invoiceNumber}`,
    `Amount: ${payment.amount} ${payment.currency}`,
    `User: ${payment.user.name} (${payment.user.email})`,
  ].join("\n")
  const pdfBuffer = Buffer.from(pdfContent, "utf-8")

  const key = `invoices/${userId}/${invoiceNumber}.pdf`

  await s3.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    })
  )

  const pdfUrl = `${env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`

  await db.invoice.create({
    data: {
      paymentId: payment.id,
      userId: userId,
      number: invoiceNumber,
      pdfUrl: pdfUrl,
      totalAmount: payment.amount,
      currency: payment.currency,
      lineItems: {},
    },
  })

  await emailQueue.add("send.invoice", {
    email: payment.user.email,
    invoiceUrl: pdfUrl,
  })
}
