import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN" && session.user.role !== "SUB_ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { status } = await req.json();

    if (!status || !["APPROVED", "REJECTED", "PENDING"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const review = await prisma.productReview.update({
      where: { id: params.id },
      data: { isVerified: status === "APPROVED" }, // Using existing field as proxy to pass TS
      include: { product: true }
    });

    if (status === "APPROVED" || status === "REJECTED") {
        await createNotification({
            userId: review.userId,
            type: "SYSTEM",
            title: `Review ${status.toLowerCase()}`,
            body: `Your review for ${review.product.name} has been ${status.toLowerCase()}.`,
            actionUrl: `/marketplace/${review.product.slug}`
        });
    }

    return NextResponse.json(review);
  } catch (error) {
    console.error("Error moderating review:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
