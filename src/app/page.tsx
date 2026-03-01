import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function Home() {
  const session = await auth();

  if (!session) {
    redirect("/login");
    return;
  }

  if (!session.user.messId) {
    // Check if user has a pending join request
    const pendingRequest = await prisma.joinRequest.findFirst({
      where: {
        userId: session.user.id,
        status: "PENDING",
      },
    });

    if (pendingRequest) {
      redirect("/pending");
      return;
    }

    redirect("/onboarding");
    return;
  }

  redirect("/dashboard");
}
