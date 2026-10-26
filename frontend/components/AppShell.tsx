"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { LogOut } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, loading, logout } = useAuth();

  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (!loading) {
      if (isLoginPage && isAuthenticated) {
        router.replace("/dashboard");
      } else if (!isLoginPage && !isAuthenticated) {
        router.replace("/login");
      }
    }
  }, [isAuthenticated, loading, isLoginPage, router]);

  // If on login page, show full-screen login without Navbar/Sidebar
  if (isLoginPage) {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Loading portal...</p>
          </div>
        </div>
      );
    }
    return (
      <main className="min-h-screen w-full flex items-center justify-center bg-slate-50">
        {children}
      </main>
    );
  }

  // If not logged in and not on login page, show clean redirecting screen
  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">
            {loading ? "Checking authentication..." : "Redirecting to login..."}
          </p>
        </div>
      </div>
    );
  }

  // Authenticated application layout
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <div className="flex-1 flex w-full">
        <Sidebar />
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1600px] w-full mx-auto overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom-Left Floating Logout Button */}
      {isAuthenticated && (
        <div className="md:hidden fixed bottom-4 left-4 z-50">
          <button
            id="mobile-bottom-left-logout-btn"
            onClick={logout}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-white/95 backdrop-blur-md border border-rose-200 text-rose-600 shadow-lg text-xs font-semibold hover:bg-rose-50 transition active:scale-95 cursor-pointer"
            title="Log Out"
          >
            <LogOut className="w-4 h-4 text-rose-500" />
            <span>Log Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
