"use client"

import { useState } from "react"

export default function AdminServiceLeadsClient({ initialLeads }: { initialLeads: any[] }) {
  const [leads, setLeads] = useState(initialLeads)
  const [selectedLead, setSelectedLead] = useState<any | null>(null)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* List */}
      <div className="lg:col-span-1 bg-[#0f172a] border border-gray-800 rounded-xl overflow-hidden flex flex-col h-[700px]">
        <div className="p-4 border-b border-gray-800 bg-[#1e293b]">
          <h2 className="font-semibold text-white">Inquiries</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {leads.map((lead) => (
            <button
              key={lead.id}
              onClick={() => setSelectedLead(lead)}
              className={`w-full text-left p-4 rounded-lg border transition ${
                selectedLead?.id === lead.id
                  ? "bg-indigo-500/10 border-indigo-500/50"
                  : "bg-[#1e293b]/50 border-transparent hover:bg-[#1e293b]"
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-medium text-white truncate pr-2">{lead.name}</span>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {new Date(lead.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-gray-400 truncate">{lead.email}</p>
              {lead.servicePage && (
                <span className="inline-block mt-2 px-2 py-0.5 bg-gray-800 text-xs text-gray-300 rounded-md">
                  {lead.servicePage.title}
                </span>
              )}
              <span className="ml-2 inline-block mt-2 px-2 py-0.5 bg-indigo-500/10 text-xs text-indigo-300 rounded-md">
                {lead.inquiryType ?? "CONTACT"}
              </span>
            </button>
          ))}
          {leads.length === 0 && (
            <div className="text-center p-6 text-gray-500">No leads found.</div>
          )}
        </div>
      </div>

      {/* Detail */}
      <div className="lg:col-span-2 bg-[#0f172a] border border-gray-800 rounded-xl h-[700px] flex flex-col">
        {selectedLead ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex justify-between items-start border-b border-gray-800 pb-6 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedLead.name}</h2>
                <div className="mt-2 space-y-1 text-sm text-gray-400">
                  <p><a href={`mailto:${selectedLead.email}`} className="text-indigo-400 hover:underline">{selectedLead.email}</a></p>
                  {selectedLead.phone && <p>Phone: {selectedLead.phone}</p>}
                  {selectedLead.company && <p>Company: {selectedLead.company}</p>}
                  <p>Inquiry: {selectedLead.inquiryType ?? "CONTACT"}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                  selectedLead.status === "NEW" ? "bg-blue-500/10 text-blue-400" : "bg-gray-500/10 text-gray-400"
                }`}>
                  {selectedLead.status}
                </span>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(selectedLead.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-3">Project Requirements</h3>
              <div className="bg-[#1e293b] rounded-lg p-4 text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">
                {selectedLead.projectRequirements}
              </div>
            </div>
            
            <div className="mt-8 flex gap-3">
               <a href={`mailto:${selectedLead.email}?subject=Re: Your Inquiry on NexusAI`} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition">
                 Reply via Email
               </a>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a lead to view details
          </div>
        )}
      </div>
    </div>
  )
}
