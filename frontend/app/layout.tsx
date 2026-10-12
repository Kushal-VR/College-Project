import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "Smart CCTV Attendance Ledger - Automated Multi-Factor Biometrics",
  description: "Enterprise CCTV Biometric Attendance Ledger with Multi-Factor Validation and Anti-Spoofing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
        <AuthProvider>
          <Navbar />
          <div className="flex-1 flex w-full">
            <Sidebar />
            <main className="flex-1 p-5 md:p-8 max-w-[1600px] w-full mx-auto overflow-y-auto">
              {children}
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
