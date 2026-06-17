import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import AuthenticatedLayout from "@/components/shared/AuthenticatedLayout/AuthenticatedLayout";

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
        <AuthProvider>
          <AuthenticatedLayout>{children}</AuthenticatedLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
