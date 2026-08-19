import { Metadata } from "next"
import FeedbackClient from "../feedback/FeedbackClient"

export const metadata: Metadata = {
  title: "Service Reviews & Feedback — NexusAI",
  description: "View verified customer ratings, user feedback, and submit your review for NexusAI products and services.",
}

export default function ReviewsPage() {
  return <FeedbackClient />
}
