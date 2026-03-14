"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redirect old manager/bazar URL to new shared /bazar page
export default function BazarRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/bazar");
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-slate-400">Redirecting to Bazar page...</p>
    </div>
  );
}
