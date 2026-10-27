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

// The darkest stop any channel reaches, used wherever something behind the
// mirror needs a colour: the page itself, and Safari's own chrome.
const MIRROR_CANVAS = "#07060f";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The app is dark edge to edge; without these the UA paints the area outside
  // the viewport (safe-area insets, rubber-band overscroll) and Safari's
  // toolbar as if this were a light page.
  colorScheme: "dark",
  themeColor: MIRROR_CANVAS,
};

export default function MirrorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/*
        The shared root layout paints the page white, which is the only white
        surface anywhere under the mirror. Any pixel its own background doesn't
        cover shows through: iPadOS 100vh/URL-bar geometry, overscroll, or a
        background layer Safari hasn't finished rasterising behind the many
        backdrop-filter panels. On the wall display that reads as the screen
        washing out to white. Keeping the page dark means the worst case is a
        flat dark panel instead. `html body` so it wins over globals.css
        regardless of which stylesheet loads first.
      */}
      <style>{`html body { background-color: ${MIRROR_CANVAS}; }`}</style>
      {children}
    </>
  );
}
