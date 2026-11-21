import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hermanus Event Feed",
  description:
    "Agent-friendly event feed for Hermanus, South Africa. What is on while your traveller is there?",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
