import type { Metadata } from "next";
import { Geist, Fraunces } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/components/top-nav";
import { cn } from "@/lib/utils";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

export const metadata: Metadata = {
  title: "my-whisky",
  description: "위스키 커뮤니티 — 보틀링 카탈로그, 테이스팅 노트, 컬렉션, 시세",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={cn("font-sans", geist.variable, fraunces.variable)}>
      <body className="min-h-screen">
        <TopNav />
        {children}
      </body>
    </html>
  );
}
