import { logger } from "@/lib/logger"

export interface OutboundCallRequest {
  id: string
  name: string
  phone: string
  email?: string
  serviceName: string
  budget?: string
  requirements?: string
  businessName?: string
  scheduledAt: number // Timestamp in ms
  attempts?: number
}

// In-memory queue of pending calls
const memoryQueue: OutboundCallRequest[] = []
let isMemoryWorkerActive = false

// Concurrency tracking (Vobiz allows max 3 concurrent calls, we cap at 2 for headroom)
const MAX_CONCURRENT_CALLS = 2
let activeCallCount = 0

// Pacing interval between consecutive call dispatches (at least 1.5s to respect 1 CPS)
const DISPATCH_PACING_MS = 1500
let lastDispatchTime = 0

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY LAYER: 24-Hour Quota & Single-Phone-Binding per User Email
// ─────────────────────────────────────────────────────────────────────────────
// Rule 1: One email can trigger only 1 voice call every 24 hours.
// Rule 2: That email can only bind to 1 single phone number within that 24-hour cycle.
// Rule 3: Email submissions to support@ and lucky@ remain completely unlimited.
// ─────────────────────────────────────────────────────────────────────────────
interface CallQuotaRecord {
  phone: string
  lastCallTimestamp: number
}

const callQuotaMap = new Map<string, CallQuotaRecord>()
const ONE_DAY_MS = 24 * 60 * 60 * 1000

/**
 * Standardize Indian phone number (+91XXXXXXXXXX)
 */
export function normalizePhoneNumber(rawPhone: string): string {
  let clean = rawPhone.replace(/[^0-9+]/g, "")
  if (!clean.startsWith("+")) {
    if (clean.length === 10) {
      clean = `+91${clean}`
    } else if (clean.startsWith("91") && clean.length === 12) {
      clean = `+${clean}`
    }
  }
  return clean
}

/**
 * Verify whether an email + phone combination is eligible for an AI Voice Agent call
 */
export function checkVoiceCallEligibility(
  email: string,
  rawPhone: string
): { eligible: boolean; reason?: string; nextAvailableAt?: string } {
  const normalizedEmail = email.trim().toLowerCase()
  const cleanPhone = normalizePhoneNumber(rawPhone)
  const now = Date.now()

  const record = callQuotaMap.get(normalizedEmail)

  if (!record) {
    // Clean record, fully eligible
    return { eligible: true }
  }

  const elapsed = now - record.lastCallTimestamp

  // If 24 hours have passed, quota resets
  if (elapsed >= ONE_DAY_MS) {
    return { eligible: true }
  }

  // Still within 24-hour cooldown
  const remainingHours = Math.ceil((ONE_DAY_MS - elapsed) / (60 * 60 * 1000))
  const nextAvailableDate = new Date(record.lastCallTimestamp + ONE_DAY_MS).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
  })

  // Check phone binding rule: Must match the registered phone number
  if (record.phone !== cleanPhone) {
    return {
      eligible: false,
      reason: `Your account is registered with ${record.phone} for voice consultations. Only that phone number is permitted for this account. Call cooldown active for next ${remainingHours} hour(s).`,
      nextAvailableAt: nextAvailableDate,
    }
  }

  return {
    eligible: false,
    reason: `You have already received a voice call consultation in the last 24 hours. Next call available in ~${remainingHours} hour(s).`,
    nextAvailableAt: nextAvailableDate,
  }
}

/**
 * Record an approved voice call trigger in the 24-hour security registry
 */
export function recordVoiceCallDispatched(email: string, rawPhone: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const cleanPhone = normalizePhoneNumber(rawPhone)

  callQuotaMap.set(normalizedEmail, {
    phone: cleanPhone,
    lastCallTimestamp: Date.now(),
  })

  logger.info({ email: normalizedEmail, phone: cleanPhone }, "[CALL-QUOTA] Registered 24h voice call reservation")
}

/**
 * Check active calls directly via Vobiz API to ensure accurate real-time channel capacity
 */
export async function getLiveActiveCallsCount(): Promise<number> {
  const authId = process.env.VOBIZ_AUTH_ID || "MA_ATII57IO"
  const authToken = process.env.VOBIZ_AUTH_TOKEN || "IPOSYnaRRQuSkpqv5AfDcuaCKx0lu2YzaT5xuBjGjHngISkK4T5RRJXHQbpMdjfT"

  try {
    const res = await fetch(`https://api.vobiz.ai/api/v1/Account/${authId}/Call/?status=live`, {
      method: "GET",
      headers: {
        "X-Auth-ID": authId,
        "X-Auth-Token": authToken,
      },
      cache: "no-store",
    })

    if (!res.ok) {
      logger.warn({ status: res.status }, "[OUTBOUND-DISPATCH] Vobiz live calls check returned non-200")
      return activeCallCount
    }

    const data = await res.json()
    const liveCount = Array.isArray(data?.calls) ? data.calls.length : 0
    return Math.max(liveCount, activeCallCount)
  } catch (err) {
    logger.error({ err }, "[OUTBOUND-DISPATCH] Failed to check Vobiz live calls")
    return activeCallCount
  }
}

/**
 * Execute outbound call via Dograh AI Workflow #15386
 */
export async function triggerDograhOutboundCall(req: OutboundCallRequest): Promise<{ success: boolean; data?: any; error?: string }> {
  const workflowUuid = process.env.DOGRAH_WORKFLOW_UUID || "f679a4eb-ab2d-4627-a97b-97f98b62b9c1"
  const apiKey = process.env.DOGRAH_API_KEY || "dgr_QTmYtfbY3W3FZXa9VSFRXBoELqTGfB86NepanT7oh40"
  const telephonyConfigId = Number(process.env.DOGRAH_TELEPHONY_CONFIG_ID || 6294)
  const fromPhoneNumberId = Number(process.env.DOGRAH_FROM_PHONE_ID || 2139)

  const cleanPhone = normalizePhoneNumber(req.phone)

  const payload = {
    phone_number: cleanPhone,
    telephony_configuration_id: telephonyConfigId,
    from_phone_number_id: fromPhoneNumberId,
    initial_context: {
      contact_name: req.name || "ji",
      consent_source: "वेबसाइट पूछताछ (Pricing Portal)",
      interest_topic: req.serviceName || "business software या automation",
      requirements_summary: req.requirements || "",
      business_name: req.businessName || "",
      budget: req.budget || "Not specified",
    },
  }

  try {
    logger.info({ phone: cleanPhone, service: req.serviceName }, "[OUTBOUND-DISPATCH] Triggering Dograh call")

    const res = await fetch(`https://api.dograh.com/api/v1/public/agent/workflow/${workflowUuid}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(payload),
    })

    const result = await res.json()

    if (!res.ok) {
      logger.error({ status: res.status, result }, "[OUTBOUND-DISPATCH] Dograh call trigger failed")
      return { success: false, error: result?.message || `HTTP ${res.status}` }
    }

    logger.info({ result }, "[OUTBOUND-DISPATCH] Dograh call initiated successfully")
    return { success: true, data: result }
  } catch (err: any) {
    logger.error({ err }, "[OUTBOUND-DISPATCH] Network error triggering Dograh call")
    return { success: false, error: err?.message || "Network error" }
  }
}

/**
 * Process queued requests respecting 1.5 min delay, pacing, and max concurrency
 */
async function processNextQueueItem() {
  if (memoryQueue.length === 0) return

  const now = Date.now()

  // 1. Find item that has passed its scheduled delay (1 to 1.5 minutes)
  const readyIndex = memoryQueue.findIndex((item) => item.scheduledAt <= now)
  if (readyIndex === -1) return

  // 2. Check pacing (stay below 1 CPS)
  if (now - lastDispatchTime < DISPATCH_PACING_MS) {
    return
  }

  // 3. Check live active call concurrency
  const currentLive = await getLiveActiveCallsCount()
  if (currentLive >= MAX_CONCURRENT_CALLS) {
    logger.debug({ currentLive }, "[OUTBOUND-DISPATCH] Channels busy, waiting for free agent line")
    return
  }

  const [item] = memoryQueue.splice(readyIndex, 1)

  // Increment active call count
  activeCallCount++
  lastDispatchTime = Date.now()

  try {
    const outcome = await triggerDograhOutboundCall(item)
    if (!outcome.success) {
      const attempts = (item.attempts || 0) + 1
      if (attempts < 3) {
        item.attempts = attempts
        item.scheduledAt = Date.now() + 30_000
        memoryQueue.push(item)
        logger.warn({ item, attempts }, "[OUTBOUND-DISPATCH] Call failed, enqueued for retry")
      }
    }
  } finally {
    setTimeout(() => {
      activeCallCount = Math.max(0, activeCallCount - 1)
    }, 45_000)
  }
}

/**
 * Start memory processor loop
 */
function ensureMemoryWorker() {
  if (isMemoryWorkerActive) return
  isMemoryWorkerActive = true

  setInterval(() => {
    processNextQueueItem().catch((err) => {
      logger.error({ err }, "[OUTBOUND-DISPATCH] Error in memory worker loop")
    })
  }, 2000)
}

/**
 * Public function to enqueue an enquiry for delayed outbound voice agent call
 * Delay: 75 seconds (1.25 minutes) to 90 seconds (1.5 minutes)
 */
export async function enqueueOutboundVoiceCall(data: Omit<OutboundCallRequest, "id" | "scheduledAt">) {
  const DELAY_MS = 75_000
  const scheduledAt = Date.now() + DELAY_MS
  const id = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

  const callItem: OutboundCallRequest = {
    ...data,
    id,
    scheduledAt,
    attempts: 0,
  }

  memoryQueue.push(callItem)
  ensureMemoryWorker()

  logger.info(
    { id, phone: data.phone, service: data.serviceName, callAt: new Date(scheduledAt).toLocaleTimeString("en-IN") },
    "[OUTBOUND-DISPATCH] Enquiry enqueued for delayed Voice Agent call"
  )

  return { enqueued: true, id, scheduledAt }
}
