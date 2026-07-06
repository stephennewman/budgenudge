import type { Metadata, Viewport } from "next";

// When /mirror is saved to the iPad home screen, these tags make it launch as
// a standalone web app: no Safari chrome and no fullscreen exit (X) button.
export const metadata: Metadata = {
  title: "Mirror",
  manifest: "/mirror.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mirror",
  },
  // Next.js emits the modern `mobile-web-app-capable` tag; older iPadOS only
  // honors the apple-prefixed one, so emit it explicitly too.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function MirrorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
