import { Building2 } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4">
      <div className="mb-8 flex items-center gap-2">
        <Building2 className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">BrokerCRM</h1>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
