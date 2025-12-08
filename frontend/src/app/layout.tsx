import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/shared/Navigation/Navigation";

export const metadata: Metadata = {
  title: "Freelance Proposal Optimizer",
  description: "Generate tailored Upwork proposals with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Navigation />
        <main>{children}</main>
      </body>
    </html>
  );
}
