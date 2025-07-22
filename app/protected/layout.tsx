import ProtectedSidebar from "@/components/protected-sidebar";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full">
      <ProtectedSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-none">
          {children}
        </div>
      </main>
    </div>
  );
}
