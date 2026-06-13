import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { auth } from "@/lib/auth"
import { createNotification } from "@/lib/notifications";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await auth();

    if (!session || !session.user || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "SUB_ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { status } = await req.json();

    if (!status || !["APPROVED", "REJECTED", "PENDING"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const review = await prisma.productReview.update({
      where: { id: params.id },
      data: { status: status },
      include: { product: true }
    });

    if (status === "APPROVED" || status === "REJECTED") {
        await createNotification({
            userId: review.userId,
            type: "SYSTEM",
            title: `Review ${status.toLowerCase()}`,
            body: `Your review for ${(review as any).product?.name} has been ${status.toLowerCase()}.`,
            actionUrl: `/marketplace/${(review as any).product?.slug}`
        });
    }

    return NextResponse.json(review);
  } catch (error) {
    console.error("Error moderating review:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
