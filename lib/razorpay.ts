import Razorpay from "razorpay"
import { env } from "@/lib/env"

export const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
})
