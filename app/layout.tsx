import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Accrual — Your finance, in focus",
  description: "A connected workspace for receivables, payables, and the general ledger.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
