"use client"

import { useState } from "react"
import { toast } from "sonner"

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string" && message.trim()) return message
  }
  return "Something went wrong"
}

export default function ServiceLeadForm({ servicePageId }: { servicePageId: string }) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const form = e.currentTarget
    const formData = new FormData(form)
    const payload = {
      servicePageId,
      inquiryType: String(formData.get("inquiryType") ?? "CONTACT"),
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: formData.get("phone") ? String(formData.get("phone")) : undefined,
      company: formData.get("company") ? String(formData.get("company")) : undefined,
      projectRequirements: String(formData.get("projectRequirements") ?? ""),
    }

    try {
      const res = await fetch("/api/public/services/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || "Failed to submit inquiry")

      setSuccess(true)
      toast.success("Inquiry submitted successfully")
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      console.error("[ServiceLeadForm] submit failed:", error)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-400 text-2xl">
          ✓
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Request Received</h3>
        <p className="text-gray-400">
          Thank you for reaching out! Our team is reviewing your requirements and will be in touch shortly.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#0f172a] border border-gray-800 rounded-2xl p-6 md:p-8 space-y-5">
      <div>
        <h3 className="text-2xl font-bold text-white mb-1">Start Your Project</h3>
        <p className="text-gray-400 text-sm">Tell us about your requirements and we'll get back to you within 24 hours.</p>
      </div>

      <div className="space-y-4 pt-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Inquiry Type</label>
          <select name="inquiryType" className="w-full bg-[#1e293b] border border-gray-700 focus:border-indigo-500 rounded-lg px-4 py-2.5 text-white outline-none transition">
            <option value="CONTACT">Contact Form</option>
            <option value="PROJECT_REQUEST">Project Request</option>
            <option value="CONSULTATION">Consultation Form</option>
            <option value="ENTERPRISE">Enterprise Inquiry</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Full Name <span className="text-red-400">*</span></label>
          <input name="name" required className="w-full bg-[#1e293b] border border-gray-700 focus:border-indigo-500 rounded-lg px-4 py-2.5 text-white outline-none transition" placeholder="John Doe" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email <span className="text-red-400">*</span></label>
            <input name="email" type="email" required className="w-full bg-[#1e293b] border border-gray-700 focus:border-indigo-500 rounded-lg px-4 py-2.5 text-white outline-none transition" placeholder="john@company.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Phone <span className="text-gray-500 text-xs ml-1">(Optional)</span></label>
            <input name="phone" type="tel" className="w-full bg-[#1e293b] border border-gray-700 focus:border-indigo-500 rounded-lg px-4 py-2.5 text-white outline-none transition" placeholder="+1 (555) 000-0000" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Company <span className="text-gray-500 text-xs ml-1">(Optional)</span></label>
          <input name="company" className="w-full bg-[#1e293b] border border-gray-700 focus:border-indigo-500 rounded-lg px-4 py-2.5 text-white outline-none transition" placeholder="Acme Inc." />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Project Requirements <span className="text-red-400">*</span></label>
          <textarea 
            name="projectRequirements" 
            required 
            rows={5}
            className="w-full bg-[#1e293b] border border-gray-700 focus:border-indigo-500 rounded-lg px-4 py-3 text-white outline-none transition resize-y" 
            placeholder="Tell us about your goals, timeline, and any specific requirements..." 
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3.5 rounded-lg transition mt-4"
      >
        {loading ? "Submitting..." : "Submit Inquiry"}
      </button>
      
      <p className="text-xs text-center text-gray-500 mt-4">
        By submitting, you agree to our Privacy Policy and Terms of Service.
      </p>
    </form>
  )
}
