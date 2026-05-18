"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

type ReviewWithRelations = {
  id: string;
  rating: number;
  title: string;
  body: string;
  status: string;
  createdAt: string;
  isVerified?: boolean;
  user: { name: string | null; email: string };
  product: { name: string };
};

export function ReviewModerationTable({ initialReviews }: { initialReviews: ReviewWithRelations[] }) {
  const [reviews, setReviews] = useState(initialReviews);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleModerate = async (id: string, status: "APPROVED" | "REJECTED" | "PENDING") => {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/reviews/${id}/moderate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setReviews(reviews.map((r) => (r.id === id ? { ...r, status } : r)));
      }
    } catch (error) {
      console.error("Failed to moderate review", error);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Review</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {reviews.map((review) => (
            <tr key={review.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{review.product.name}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {review.user.name || review.user.email}
                {review.isVerified && <span className="ml-2 text-xs text-green-600 bg-green-50 px-1 rounded">Verified</span>}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500 max-w-md">
                <div className="font-medium text-gray-900">{review.title} ({review.rating}★)</div>
                <div className="truncate">{review.body}</div>
                <div className="text-xs text-gray-400 mt-1">{formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${(review as any).status === 'APPROVED' ? 'bg-green-100 text-green-800' : (review as any).status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {(review as any).status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                <button
                  disabled={loadingId === review.id || (review as any).status === "APPROVED"}
                  onClick={() => handleModerate(review.id, "APPROVED")}
                  className="text-green-600 hover:text-green-900 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  disabled={loadingId === review.id || (review as any).status === "REJECTED"}
                  onClick={() => handleModerate(review.id, "REJECTED")}
                  className="text-red-600 hover:text-red-900 disabled:opacity-50"
                >
                  Reject
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}