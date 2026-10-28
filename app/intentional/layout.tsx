import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Intentional",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Intentional",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fafaf9",
};

export default function IntentionalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`html,body{background:#fafaf9;overscroll-behavior-y:none}`}</style>
      {children}
    </>
  );
}
