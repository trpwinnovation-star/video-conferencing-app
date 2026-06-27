import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const roomId = decodeURIComponent(resolvedParams.id);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://video-confrencing-frontend.onrender.com").replace(/\/$/, "");
  const roomUrl = `${appUrl}/room/${encodeURIComponent(resolvedParams.id)}`;
  const imageUrl = `${appUrl}/logo_betel.png`;

  return {
    metadataBase: new URL(appUrl),
    title: `Join Meeting: ${roomId} | BetelMeet`,
    description: `You have been invited to join a real-time video meeting (${roomId}) on BetelMeet. Click the link to join.`,
    openGraph: {
      title: `Join Meeting: ${roomId} | BetelMeet`,
      description: `You have been invited to join a real-time video meeting (${roomId}) on BetelMeet. Click the link to join.`,
      url: roomUrl,
      siteName: "BetelMeet",
      images: [
        {
          url: imageUrl,
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
      title: `Join Meeting: ${roomId} | BetelMeet`,
      description: `You have been invited to join a real-time video meeting (${roomId}) on BetelMeet. Click the link to join.`,
      images: [imageUrl],
    },
    icons: {
      icon: "/logo_betel.png",
      shortcut: "/logo_betel.png",
      apple: "/logo_betel.png",
    },
  };
}

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
