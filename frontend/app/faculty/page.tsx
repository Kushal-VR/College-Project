"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FacultyRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/classroom");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
      <div className="w-8 h-8 rounded-full border-2 border-blue-500/20 border-t-blue-600 animate-spin" />
      <p className="text-xs text-slate-500 font-medium">Redirecting to My Classroom...</p>
    </div>
  );
}
