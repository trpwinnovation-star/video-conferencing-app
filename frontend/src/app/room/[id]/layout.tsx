import type { Metadata } from "next";

type Props = {
  params: { id: string };
};

export function generateMetadata({ params }: Props): Metadata {
  const roomId = decodeURIComponent(params.id);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://video-confrencing-frontend.onrender.com").replace(/\/$/, "");
  const roomUrl = `${appUrl}/room/${encodeURIComponent(params.id)}`;
  const imageUrl = `${appUrl}/betel.jpeg`;

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
      title: `Join Meeting: ${roomId} | BetelMeet`,
      description: `You have been invited to join a real-time video meeting (${roomId}) on BetelMeet. Click the link to join.`,
      images: [imageUrl],
    },
    icons: {
      icon: imageUrl,
      shortcut: imageUrl,
      apple: imageUrl,
    },
  };
}

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
