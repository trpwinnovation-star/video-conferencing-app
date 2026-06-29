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
    icon: "/betel.jpeg",
    shortcut: "/betel.jpeg",
    apple: "/betel.jpeg",
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
        url: "/betel.jpeg",
        width: 800,
        height: 800,
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
    images: ["/betel.jpeg"],
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
