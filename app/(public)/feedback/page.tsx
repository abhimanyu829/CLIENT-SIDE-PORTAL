import { Metadata } from "next"
import FeedbackClient from "./FeedbackClient"

export const metadata: Metadata = {
  title: "Customer Feedback & Star Ratings — NexusAI",
  description: "View verified customer ratings, user feedback, and submit your review for NexusAI products and services.",
}

export default function FeedbackPage() {
  return <FeedbackClient />
}
