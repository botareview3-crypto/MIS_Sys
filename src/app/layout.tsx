import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AUC MIS Repair Management",
  description: "Device repair tracking and workflow management",
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
