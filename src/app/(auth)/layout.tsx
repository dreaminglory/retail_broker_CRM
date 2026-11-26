import { AuthHero } from "./auth-hero";
import { BrandMark } from "./brand-mark";
import { LanguageToggle } from "./language-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <AuthHero />
      <div className="relative flex flex-col items-center justify-center px-4 py-16 lg:border-l lg:border-border">
        <div className="absolute right-4 top-4 lg:right-8 lg:top-8">
          <LanguageToggle />
        </div>
        {/* The logo moves here when the left half is hidden (phones, tablets). */}
        <div className="mb-8 lg:hidden">
          <BrandMark nameClassName="text-title text-ink" />
        </div>
        <div className="w-full max-w-[400px]">{children}</div>
      </div>
    </div>
  );
}
