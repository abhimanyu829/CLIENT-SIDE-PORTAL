import PusherServer from "pusher"
import PusherClient from "pusher-js"

// SERVER INSTANCE
export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID || "",
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || "",
  secret: process.env.PUSHER_SECRET || "",
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "us2",
  useTLS: true,
})

// CLIENT INSTANCE
export const pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY || "dummy-key", {
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "us2",
  authEndpoint: "/api/pusher/auth", // if private channels are needed
})
