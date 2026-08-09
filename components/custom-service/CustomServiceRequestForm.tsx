"use client"

import { ChangeEvent, FormEvent, useState } from "react"
import {
  ArrowLeft, ArrowRight, Building2, Calendar, CheckCircle2,
  DollarSign, FileText, Loader2, Paperclip, Send, Sparkles,
  Target, User, X, Zap,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────
type UploadedFile = { fileName: string; mimeType: string; sizeBytes: number; storageKey: string; url: string }

const MAX_FILE_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip", "application/x-zip-compressed",
])

const SERVICE_CATEGORIES = [
  "Custom Software Development",
  "AI Agent or Automation",
  "Website or Web Application",
  "Mobile Application",
  "API or Integration",
  "Cloud or Enterprise Solution",
  "Consulting or Digital Transformation",
  "Other",
]

const BUDGET_OPTIONS = [
  "Under ₹50,000",
  "₹50,000 – ₹2,00,000",
  "₹2,00,000 – ₹10,00,000",
  "₹10,00,000 – ₹50,00,000",
  "Above ₹50,00,000",
  "Under $1,000",
  "$1,000 – $10,000",
  "$10,000 – $50,000",
  "$50,000 – $200,000",
  "Above $200,000",
  "To be discussed",
]

const TIMELINE_OPTIONS = [
  "ASAP (1–2 weeks)",
  "1 month",
  "2–3 months",
  "3–6 months",
  "6–12 months",
  "Flexible / Open-ended",
]

// ─── Feature flag — file uploads require R2 to be configured ──────────────────
const uploadsEnabled = Boolean(process.env.NEXT_PUBLIC_R2_PUBLIC_URL)

// ─── Upload helper ────────────────────────────────────────────────────────────
async function upload(file: File): Promise<UploadedFile> {
  if (!ALLOWED_TYPES.has(file.type))
    throw new Error("Use an image, PDF, Word document, or ZIP file.")
  if (file.size > MAX_FILE_BYTES)
    throw new Error(`${file.name} is larger than 10 MB.`)
  const prepared = await fetch("/api/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type, folder: "service-requests" }),
  })
  const ticket = await prepared.json()
  if (!prepared.ok) throw new Error(ticket.error || "Unable to prepare upload")
  const sent = await fetch(ticket.uploadUrl, {
    method: "PUT",
    headers: { "content-type": file.type },
    body: file,
  })
  if (!sent.ok) throw new Error(`Unable to upload ${file.name}`)
  return { fileName: file.name, mimeType: file.type, sizeBytes: file.size, storageKey: ticket.key, url: ticket.publicUrl }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Step indicator ────────────────────────────────────────────────────────────
const STEPS_WITH_FILES = [
  { label: "Personal Info",  icon: User },
  { label: "Project",        icon: Sparkles },
  { label: "Files",          icon: Paperclip },
  { label: "Review",         icon: CheckCircle2 },
]
const STEPS_NO_FILES = [
  { label: "Personal Info",  icon: User },
  { label: "Project",        icon: Sparkles },
  { label: "Review",         icon: CheckCircle2 },
]

function StepBar({ current, steps }: { current: number; steps: typeof STEPS_WITH_FILES }) {
  return (
    <div className="flex items-center gap-0 mb-10">
      {steps.map((step, i) => {
        const done    = i < current
        const active  = i === current
        const Icon    = step.icon
        return (
          <div key={i} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1.5 min-w-[56px]">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                transition-all duration-300
                ${done   ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                : active ? "bg-amber-600  text-white shadow-lg shadow-amber-600/30 ring-4 ring-amber-600/20"
                :          "bg-muted      text-muted-foreground"}
              `}>
                {done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`text-[10px] font-semibold uppercase tracking-wider hidden sm:block
                ${active ? "text-amber-700" : done ? "text-emerald-600" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 transition-all duration-500 ${done ? "bg-emerald-400" : "bg-border"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Field primitives ─────────────────────────────────────────────────────────
function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="block text-sm font-semibold text-foreground mb-1.5">
      {children} {required && <span className="text-red-500">*</span>}
    </span>
  )
}

function Input({ label, required, hint, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; required?: boolean; hint?: string }) {
  return (
    <div className="space-y-1">
      <Label required={required}>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground -mt-1 mb-1">{hint}</p>}
      <input
        {...props}
        required={required}
        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-600/25 focus:border-amber-600/50 transition-all disabled:cursor-not-allowed disabled:bg-muted/30 disabled:text-muted-foreground"
      />
    </div>
  )
}

function Textarea({ label, required, hint, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; required?: boolean; hint?: string }) {
  return (
    <div className="space-y-1">
      <Label required={required}>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground -mt-1 mb-1">{hint}</p>}
      <textarea
        {...props}
        required={required}
        rows={props.rows ?? 4}
        className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-600/25 focus:border-amber-600/50 transition-all min-h-[100px]"
      />
    </div>
  )
}

function Select({ label, required, hint, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; required?: boolean; hint?: string; options: string[] }) {
  return (
    <div className="space-y-1">
      <Label required={required}>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground -mt-1 mb-1">{hint}</p>}
      <select
        {...props}
        required={required}
        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-600/25 focus:border-amber-600/50 transition-all"
      >
        <option value="">Select an option</option>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  )
}

// ─── Review row helper ─────────────────────────────────────────────────────────
function ReviewRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-3 border-b border-border last:border-0">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-0.5">{label}</dt>
      <dd className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{value}</dd>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function CustomServiceRequestForm({ name, email }: { name: string; email: string }) {
  const STEPS = uploadsEnabled ? STEPS_WITH_FILES : STEPS_NO_FILES
  // When uploads are disabled step 2 = Review (skip the Files step)
  const STEP_REVIEW = uploadsEnabled ? 3 : 2
  const STEP_FILES  = 2  // only used when uploadsEnabled
  const [step, setStep] = useState(0)

  // Step 1 — Personal
  const [fullName,    setFullName]    = useState(name ?? "")
  const [phone,       setPhone]       = useState("")
  const [companyName, setCompanyName] = useState("")

  // Step 2 — Project
  const [serviceCategory,   setServiceCategory]   = useState("")
  const [projectTitle,      setProjectTitle]      = useState("")
  const [ideaDescription,   setIdeaDescription]   = useState("")
  const [problemStatement,  setProblemStatement]  = useState("")
  const [requestedFeatures, setRequestedFeatures] = useState("")
  const [targetUsers,       setTargetUsers]       = useState("")
  const [expectedBudget,    setExpectedBudget]    = useState("")
  const [expectedTimeline,  setExpectedTimeline]  = useState("")
  const [additionalNotes,   setAdditionalNotes]   = useState("")

  // Step 3 — Files
  const [attachments, setAttachments] = useState<UploadedFile[]>([])
  const [uploading,   setUploading]   = useState(false)
  const [fileError,   setFileError]   = useState<string | null>(null)

  // Step 4 — Submit
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Step 1 validation ────
  const step1Valid = fullName.trim().length >= 2 && phone.trim().length >= 7

  // ── Step 2 validation ────
  const step2Valid = serviceCategory && projectTitle.trim().length >= 3 && ideaDescription.trim().length >= 20

  // ── File upload ──────────
  async function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, Math.max(0, 8 - attachments.length))
    if (!files.length) return
    setUploading(true); setFileError(null)
    try {
      setAttachments((cur) => [...cur, ...([] as UploadedFile[])])
      const uploaded = await Promise.all(files.map(upload))
      setAttachments((cur) => [...cur, ...uploaded])
    } catch (e) {
      setFileError(e instanceof Error ? e.message : "Unable to upload file")
    } finally {
      setUploading(false)
      event.target.value = ""
    }
  }

  function removeFile(key: string) {
    setAttachments((cur) => cur.filter((f) => f.storageKey !== key))
  }

  // ── Submit ───────────────
  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true); setSubmitError(null)
    const payload = {
      fullName, phone, companyName: companyName || undefined,
      serviceCategory, projectTitle, ideaDescription,
      problemStatement: problemStatement || undefined,
      requestedFeatures: requestedFeatures || undefined,
      targetUsers: targetUsers || undefined,
      expectedBudget: expectedBudget || undefined,
      expectedTimeline: expectedTimeline || undefined,
      additionalNotes: additionalNotes || undefined,
      attachments,
    }
    const res  = await fetch("/api/custom-service-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => null)
    setSubmitting(false)
    if (!data?.success) { setSubmitError(data?.error || "Unable to submit your request"); return }
    window.location.assign(`/dashboard/service-requests/${data.data.id}`)
  }

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full">
      <StepBar current={step} steps={STEPS} />

      {/* ── STEP 1 — Personal Info ── */}
      {step === 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-amber-600/10 flex items-center justify-center">
              <User className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Tell us about yourself</h2>
              <p className="text-sm text-muted-foreground">Your account email keeps this request private and secure.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Full name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
            />
            <div className="space-y-1">
              <Label>Email</Label>
              <div className="flex items-center gap-2 w-full rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground cursor-not-allowed">
                <span className="flex-1 truncate">{email}</span>
                <span className="text-xs bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-medium border border-emerald-500/20">Verified</span>
              </div>
              <p className="text-xs text-muted-foreground">Linked to your account — cannot be changed here.</p>
            </div>
            <Input
              label="Phone number"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              type="tel"
            />
            <div className="space-y-1">
              <Label>Company name</Label>
              <div className="flex items-center gap-2 w-full rounded-xl border border-border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-amber-600/25 focus-within:border-amber-600/50 transition-all">
                <Building2 className="w-4 h-4 text-muted-foreground ml-4 shrink-0" />
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your company or startup (optional)"
                  className="flex-1 py-3 pr-4 text-sm text-foreground bg-transparent outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="button"
              disabled={!step1Valid}
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-700/25 hover:bg-amber-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2 — Project Details ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-violet-500/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Project details</h2>
              <p className="text-sm text-muted-foreground">The more context you share, the better our first discussion will be.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Service category"
              required
              options={SERVICE_CATEGORIES}
              value={serviceCategory}
              onChange={(e) => setServiceCategory(e.target.value)}
            />
            <Input
              label="Project title"
              required
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="e.g. AI-powered inventory system"
            />
          </div>

          <Textarea
            label="Describe your idea"
            required
            hint="What would you like to build? Give us a clear picture."
            value={ideaDescription}
            onChange={(e) => setIdeaDescription(e.target.value)}
            placeholder="We want to build a platform that helps small businesses automate their invoicing process using AI..."
            rows={5}
          />

          <Textarea
            label="What problem are you trying to solve?"
            hint="Understanding the root problem helps us design the right solution."
            value={problemStatement}
            onChange={(e) => setProblemStatement(e.target.value)}
            placeholder="Currently our team spends 3 hours a day manually creating invoices..."
          />

          <Textarea
            label="What features do you need?"
            hint="List essential features, integrations, or workflows. Don't worry about being too detailed."
            value={requestedFeatures}
            onChange={(e) => setRequestedFeatures(e.target.value)}
            placeholder="- Automatic invoice generation\n- WhatsApp notifications\n- Payment gateway integration\n- Dashboard with analytics"
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>
                <Target className="inline w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                Target users
              </Label>
              <input
                value={targetUsers}
                onChange={(e) => setTargetUsers(e.target.value)}
                placeholder="e.g. small business owners"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-600/25 focus:border-amber-600/50 transition-all"
              />
            </div>
            <div className="space-y-1">
              <Label>
                <DollarSign className="inline w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                Expected budget
              </Label>
              <select
                value={expectedBudget}
                onChange={(e) => setExpectedBudget(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-600/25 focus:border-amber-600/50 transition-all"
              >
                <option value="">Select a range</option>
                {BUDGET_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>
                <Calendar className="inline w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                Expected timeline
              </Label>
              <select
                value={expectedTimeline}
                onChange={(e) => setExpectedTimeline(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-600/25 focus:border-amber-600/50 transition-all"
              >
                <option value="">Select a timeframe</option>
                {TIMELINE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          <Textarea
            label="Anything else to share?"
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="Any existing systems, constraints, inspirations, competitors, or references you'd like us to know about..."
          />

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              type="button"
              disabled={!step2Valid}
              onClick={() => setStep(uploadsEnabled ? STEP_FILES : STEP_REVIEW)}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-700/25 hover:bg-amber-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {uploadsEnabled ? "Continue" : "Review request"} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3 — Supporting Files (only shown when R2 is configured) ── */}
      {uploadsEnabled && step === STEP_FILES && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <Paperclip className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Supporting files</h2>
              <p className="text-sm text-muted-foreground">Attach wireframes, mockups, references, or documents (optional, up to 8 files, 10 MB each).</p>
            </div>
          </div>

          {/* Drop zone */}
          <label className={`
            relative flex flex-col items-center justify-center gap-3 w-full rounded-2xl border-2 border-dashed
            px-6 py-14 text-center cursor-pointer transition-all
            ${uploading
              ? "border-amber-600/40 bg-amber-600/5"
              : "border-border bg-muted/20 hover:border-amber-600/40 hover:bg-amber-600/5"}
            ${attachments.length >= 8 ? "pointer-events-none opacity-40" : ""}
          `}>
            <input
              type="file"
              multiple
              className="hidden"
              accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.zip"
              onChange={onFiles}
              disabled={uploading || attachments.length >= 8}
            />
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
              {uploading
                ? <Loader2 className="w-6 h-6 text-amber-700 animate-spin" />
                : <Paperclip className="w-6 h-6 text-muted-foreground" />
              }
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {uploading ? "Uploading files…" : "Click to attach files"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Images, PDF, Word, ZIP — up to 10 MB each</p>
            </div>
          </label>

          {fileError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <X className="w-4 h-4 shrink-0" />
              {fileError}
            </div>
          )}

          {/* File list */}
          {attachments.length > 0 && (
            <div className="space-y-2">
              {attachments.map((file) => (
                <div
                  key={file.storageKey}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{file.fileName}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(file.sizeBytes)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(file.storageKey)}
                    className="text-muted-foreground hover:text-red-500 transition-colors"
                    aria-label={`Remove ${file.fileName}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {attachments.length === 0 && !uploading && (
            <p className="text-sm text-center text-muted-foreground py-2">
              No files attached yet — this step is optional.
            </p>
          )}

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-700/25 hover:bg-amber-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Review request <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4 — Review & Submit ── */}
      {step === STEP_REVIEW && (
        <form onSubmit={submit} className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Review your request</h2>
              <p className="text-sm text-muted-foreground">Everything look correct? Submit to open your private discussion with the NexusAI team.</p>
            </div>
          </div>

          {/* Personal section */}
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/30">
              <User className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Personal Information</h3>
            </div>
            <dl className="px-5">
              <ReviewRow label="Full Name"    value={fullName} />
              <ReviewRow label="Email"        value={email} />
              <ReviewRow label="Phone"        value={phone || null} />
              <ReviewRow label="Company"      value={companyName || null} />
            </dl>
          </div>

          {/* Project section */}
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/30">
              <Zap className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Project Details</h3>
            </div>
            <dl className="px-5">
              <ReviewRow label="Category"    value={serviceCategory} />
              <ReviewRow label="Title"       value={projectTitle} />
              <ReviewRow label="Idea"        value={ideaDescription} />
              <ReviewRow label="Problem"     value={problemStatement || null} />
              <ReviewRow label="Features"    value={requestedFeatures || null} />
              <ReviewRow label="Users"       value={targetUsers || null} />
              <ReviewRow label="Budget"      value={expectedBudget || null} />
              <ReviewRow label="Timeline"    value={expectedTimeline || null} />
              <ReviewRow label="Notes"       value={additionalNotes || null} />
            </dl>
          </div>

          {/* Files section */}
          {attachments.length > 0 && (
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/30">
                <Paperclip className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Attachments ({attachments.length})</h3>
              </div>
              <div className="px-5 py-3 space-y-2">
                {attachments.map((f) => (
                  <div key={f.storageKey} className="flex items-center gap-3 text-sm">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-foreground truncate">{f.fileName}</span>
                    <span className="text-muted-foreground text-xs">{formatBytes(f.sizeBytes)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info banner */}
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/10 px-5 py-4">
            <Sparkles className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
              After submitting, you will be redirected to a <strong>private discussion page</strong> where the NexusAI team will contact you, ask follow-up questions, and share a proposal.
            </p>
          </div>

          {submitError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <X className="w-4 h-4 shrink-0" /> {submitError}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(uploadsEnabled ? STEP_FILES : 1)}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-amber-700/25 hover:bg-amber-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                : <><Send className="w-4 h-4" /> Submit Service Request</>
              }
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
