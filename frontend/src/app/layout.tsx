import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeProvider } from "@/lib/theme";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kiwi CRM",
  description: "Enterprise CRM managing company relationships, sales pipelines, projects, service desk, accounting, and delivery lifecycle.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("crm_pref_theme")||"system";var d=document.documentElement;if(t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches)){d.classList.add("dark");}else{d.classList.remove("dark");}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${inter.className} h-full flex flex-col text-slate-900 dark:text-slate-100 overflow-hidden`}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
