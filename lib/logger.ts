import pino from "pino"
import { env } from "@/lib/env"

const isProduction = env.NODE_ENV === "production"

// ── Root logger ───────────────────────────────────────────────────────────────

export const logger = pino({
  level: isProduction ? "info" : "debug",
  base: { service: "start-client" },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: !isProduction
    ? {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
      }
    : undefined,
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
})

// ── Child loggers (pre-bound with context) ────────────────────────────────────

export const dbLogger = logger.child({ module: "db" })
export const authLogger = logger.child({ module: "auth" })
export const apiLogger = logger.child({ module: "api" })
export const emailLogger = logger.child({ module: "email" })
export const queueLogger = logger.child({ module: "queue" })
export const paymentLogger = logger.child({ module: "payment" })

/**
 * Creates an ad-hoc child logger for a specific module or request.
 * @example const log = createLogger("tickets")
 *          log.info({ ticketId }, "Ticket created")
 */
export function createLogger(module: string, context?: Record<string, unknown>) {
  return logger.child({ module, ...context })
}
