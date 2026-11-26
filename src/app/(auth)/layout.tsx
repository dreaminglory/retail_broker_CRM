const BRAND = "BrokerCRM";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-8 flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-md bg-primary text-body-strong text-primary-foreground"
        >
          {BRAND.charAt(0)}
        </span>
        <span className="text-title text-ink">{BRAND}</span>
      </div>
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}
