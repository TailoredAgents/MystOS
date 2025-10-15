import "@/lib/react-internals-polyfill";
import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { absoluteUrl, siteUrl } from "@/lib/metadata";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600"]
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["700"]
});

const defaultTitle = "Myst Pressure Washing";
const defaultDescription =
  "Premium soft-wash and pressure washing across North Metro Atlanta. Schedule an on-site estimate and get spotless results backed by our make-it-right guarantee.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultTitle,
    template: "%s | Myst Pressure Washing"
  },
  description: defaultDescription,
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    url: siteUrl,
    siteName: defaultTitle,
    images: [{ url: absoluteUrl("/images/hero/home.jpg") }],
    type: "website"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="antialiased bg-neutral-100 text-neutral-900 font-sans">
        {children}
      </body>
    </html>
  );
}


