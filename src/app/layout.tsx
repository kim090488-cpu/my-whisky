import type { Metadata } from "next";
import { Geist, Fraunces } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/components/top-nav";
import { SiteFooter } from "@/components/site-footer";
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
  metadataBase: new URL("https://mywhisky-kr.vercel.app"),
  title: {
    default: "my-whisky · 위스키 커뮤니티",
    template: "%s · my-whisky",
  },
  description: "위스키 커뮤니티 — 보틀링 카탈로그, 테이스팅 노트, 컬렉션, 랭킹, AI 큐레이터",
  applicationName: "my-whisky",
  keywords: ["위스키", "whisky", "테이스팅 노트", "위스키 컬렉션", "싱글 몰트", "증류소"],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "my-whisky",
    title: "my-whisky · 위스키 커뮤니티",
    description: "보틀링 카탈로그와 테이스팅 노트, 취향 기반 AI 큐레이터",
  },
  twitter: {
    card: "summary_large_image",
    title: "my-whisky · 위스키 커뮤니티",
    description: "보틀링 카탈로그와 테이스팅 노트, 취향 기반 AI 큐레이터",
  },
  robots: {
    index: true,
    follow: true,
  },
  formatDetection: {
    email: false,
    telephone: false,
    address: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={cn("font-sans", geist.variable, fraunces.variable)}>
      <body className="flex min-h-screen flex-col">
        <TopNav />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
