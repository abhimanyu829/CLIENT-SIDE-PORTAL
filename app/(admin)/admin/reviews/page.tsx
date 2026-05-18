import { db as prisma } from "@/lib/db";
import { ReviewModerationTable } from "@/components/admin/ReviewModerationTable";

export default async function AdminReviewsPage() {
  const reviews = await prisma.productReview.findMany({
    include: {
      user: { select: { name: true, email: true } },
      product: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const serializedReviews = reviews.map((r: any) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Review Moderation</h1>
      </div>
      <div className="bg-white shadow rounded-lg">
        <ReviewModerationTable initialReviews={serializedReviews} />
      </div>
    </div>
  );
}
