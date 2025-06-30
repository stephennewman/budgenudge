export default function Content({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-6 w-full flex items-center justify-between">
      {children}
    </div>
  );
}
