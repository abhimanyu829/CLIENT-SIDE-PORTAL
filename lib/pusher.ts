import PusherServer from "pusher"
import PusherClient from "pusher-js"

// SERVER INSTANCE
export const pusherServer = (typeof PusherServer === 'function') ? new PusherServer({
  appId: process.env.PUSHER_APP_ID || "dummy",
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || "dummy",
  secret: process.env.PUSHER_SECRET || "dummy",
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "us2",
  useTLS: true,
}) : ({
  trigger: async () => {},
} as any);

// CLIENT INSTANCE
export const pusherClient = (typeof PusherClient === 'function') ? new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY || "dummy-key", {
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "us2",
  authEndpoint: "/api/pusher/auth", // if private channels are needed
}) : ({
  subscribe: () => ({ bind: () => {}, unbind_all: () => {}, unsubscribe: () => {} }),
  unsubscribe: () => {}
} as any);