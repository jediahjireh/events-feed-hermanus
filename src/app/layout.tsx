import type { Metadata } from "next";
import { Crimson_Text, Montserrat } from "next/font/google";
import { Navbar } from "@/components/nav/navbar";
import Providers from "@/providers/providers";
import "./globals.css";

const crimsonText = Crimson_Text({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-heading",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Hermanus Event Feed",
  description:
    "What is on while your traveller is there? Local events in Hermanus, South Africa.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${crimsonText.variable} ${montserrat.variable}`}>
      <body className="font-body antialiased">
        <Providers>
          <Navbar />
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
