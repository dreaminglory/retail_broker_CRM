const BRAND = "BrokerCRM";

/** The logo mark and name; the left half of the auth screens and the phone header both use it. */
export function BrandMark({ nameClassName }: { nameClassName: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="flex size-9 items-center justify-center rounded-md bg-primary text-body-strong text-primary-foreground"
      >
        {BRAND.charAt(0)}
      </span>
      <span className={nameClassName}>{BRAND}</span>
    </div>
  );
}
