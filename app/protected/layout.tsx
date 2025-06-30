import Content from "@/components/content";
import ProtectedSidebar from "@/components/protected-sidebar";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Content>
      <div className="flex w-full h-full">
        <ProtectedSidebar />
        <div className="flex-1 pl-4 pr-4 py-2 overflow-x-auto">{children}</div>
      </div>
    </Content>
  );
}
