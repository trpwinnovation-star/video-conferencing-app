import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://video-confrencing-frontend.onrender.com";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  icons: {
    icon: "/logo_betel.png",
    shortcut: "/logo_betel.png",
    apple: "/logo_betel.png",
  },
  title: "BetelMeet",
  description: "Real-time meetings by BetelMeet. Using your browser, share your video, desktop, and presentations with teammates and customers.",
  openGraph: {
    title: "BetelMeet",
    description: "Real-time meetings by BetelMeet. Using your browser, share your video, desktop, and presentations with teammates and customers.",
    url: appUrl,
    siteName: "BetelMeet",
    images: [
      {
        url: "/logo_betel.png",
        width: 1200,
        height: 630,
        alt: "BetelMeet Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BetelMeet",
    description: "Real-time meetings by BetelMeet. Using your browser, share your video, desktop, and presentations with teammates and customers.",
    images: ["/logo_betel.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className={`min-h-full flex flex-col ${inter.className}`} suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
