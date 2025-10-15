import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StickyCtaBar } from "@/components/StickyCtaBar";
import { ChatBot } from "@/components/ChatBot";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-white via-neutral-100 to-white">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <ChatBot />
      <StickyCtaBar />
    </div>
  );
}



