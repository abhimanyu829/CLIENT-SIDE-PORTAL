"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function AdminServicesClient({ initialServices }: { initialServices: any[] }) {
  const router = useRouter()
  const [services, setServices] = useState(initialServices)

  return (
    <div className="space-y-4">
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => router.push("/admin/services/new")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition"
        >
          Create New Service
        </button>
        <button
          onClick={() => router.push("/admin/services/leads")}
          className="bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition"
        >
          View Leads
        </button>
        <button
          onClick={() => router.push("/admin/services/categories")}
          className="bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition"
        >
          Manage Categories
        </button>
      </div>

      <div className="bg-[#0f172a] border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-[#1e293b] text-gray-300 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Title</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Slug</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Leads</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {services.map((service) => (
              <tr key={service.id} className="hover:bg-gray-800/50 transition">
                <td className="px-6 py-4 font-medium text-white">{service.title}</td>
                <td className="px-6 py-4">{service.category?.name || "Unassigned"}</td>
                <td className="px-6 py-4">{service.slug}</td>
                <td className="px-6 py-4">
                  {service.isActive ? (
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-500/10 text-green-400">
                      Active
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-500/10 text-gray-400">
                      Draft
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">{service._count.leads}</td>
                <td className="px-6 py-4 text-right space-x-3">
                  <button
                    onClick={() => router.push(`/admin/services/${service.id}`)}
                    className="text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No services found. Create your first service page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
