import type { Metadata } from "next";
import "./globals.css";
import RuntimeErrors from "@/components/runtime-errors";

export const metadata: Metadata = {
  title: "AD Product Uploader · Products made simple",
  description: "AD Product Uploader — your everyday workspace for WooCommerce products.",
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
      <body className="antialiased"><RuntimeErrors/>{children}</body>
    </html>
  );
}
