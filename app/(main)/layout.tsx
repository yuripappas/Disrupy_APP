import { Sidebar } from "@/components/layout/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto" style={{ backgroundColor: "#F8FAFC" }}>
        {children}
      </main>
    </div>
  );
}
