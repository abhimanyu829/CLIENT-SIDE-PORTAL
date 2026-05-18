import { ProductReview, User } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { StarIcon, CheckBadgeIcon } from "@heroicons/react/24/solid";

type ReviewWithUser = ProductReview & {
  user: Pick<User, "name" | "avatarUrl">;
};

export function ReviewCard({ review }: { review: ReviewWithUser }) {
  if ((review as any).status && (review as any).status !== "APPROVED") {
    return null;
  }

  return (
    <div className="border rounded-lg p-4 shadow-sm bg-white">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-3">
          {review.user.avatarUrl ? (
            <img src={review.user.avatarUrl} alt={review.user.name || "User"} className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-medium">
              {review.user.name?.charAt(0) || "U"}
            </div>
          )}
          <div>
            <div className="flex items-center">
              <span className="font-semibold text-gray-900 mr-2">{review.user.name || "Anonymous User"}</span>
              {review.verifiedPurchase && (
                <span className="inline-flex items-center text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                  <CheckBadgeIcon className="w-3 h-3 mr-1" />
                  Verified Buyer
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>
        <div className="flex">
          {[...Array(5)].map((_, i) => (
            <StarIcon
              key={i}
              className={`w-5 h-5 ${i < review.rating ? "text-yellow-400" : "text-gray-200"}`}
            />
          ))}
        </div>
      </div>
      <h4 className="font-medium text-gray-900 mt-2">{review.title}</h4>
      <p className="text-gray-600 mt-1 text-sm whitespace-pre-line">{review.body}</p>
    </div>
  );
}
