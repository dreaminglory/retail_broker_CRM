import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";

const POINTS = ["point1", "point2", "point3"] as const;

/** Three spot illustrations (building, house, person) drawn with theme tokens only. */
function SpotArt() {
  return (
    <svg viewBox="0 0 414 176" role="presentation" aria-hidden className="h-auto w-full max-w-[414px]">
      <rect x="1" y="1" width="152" height="174" rx="14" className="fill-info-soft stroke-ink" strokeWidth="2" />
      <rect x="44" y="46" width="60" height="110" className="fill-ink" />
      <rect x="62" y="68" width="10" height="10" className="fill-surface" />
      <rect x="82" y="68" width="10" height="10" className="fill-surface" />
      <rect x="62" y="92" width="10" height="10" className="fill-surface" />
      <rect x="82" y="92" width="10" height="10" className="fill-surface" />
      <rect x="62" y="116" width="10" height="10" className="fill-surface" />
      <rect x="82" y="116" width="10" height="10" className="fill-surface" />
      <rect x="64" y="136" width="20" height="20" className="fill-sea" />

      <rect x="173" y="41" width="124" height="134" rx="14" className="fill-highlight stroke-ink" strokeWidth="2" />
      <circle cx="270" cy="76" r="14" className="fill-action" />
      <path d="M188 150 V110 L235 82 L282 110 V150 Z" className="fill-ink" />
      <rect x="212" y="122" width="22" height="28" className="fill-sea" />
      <rect x="196" y="112" width="10" height="10" className="fill-surface" />

      <rect x="317" y="49" width="96" height="126" rx="14" className="fill-sea-light stroke-ink" strokeWidth="2" />
      <circle cx="365" cy="96" r="18" className="fill-sea stroke-ink" strokeWidth="4" />
      <path d="M333 168 C333 140 349 128 365 128 C381 128 397 140 397 168 Z" className="fill-ink" />
    </svg>
  );
}

/** The left half of the auth screens (login.png): logo, spot art, promise, three points, footer. */
export async function AuthHero() {
  const t = await getTranslations("auth.hero");
  const brand = "BrokerCRM";

  return (
    <div className="hidden flex-col justify-between bg-sidebar p-12 lg:flex">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-md bg-primary text-body-strong text-primary-foreground"
        >
          {brand.charAt(0)}
        </span>
        <span className="text-body-strong text-ink">{brand}</span>
      </div>

      <div className="max-w-[460px]">
        <SpotArt />
        <h2 className="mt-8 text-display text-ink">{t("headline")}</h2>
        <ul className="mt-6 space-y-3">
          {POINTS.map((key) => (
            <li key={key} className="flex items-center gap-3 text-body text-ink">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                <Check className="size-3.5" aria-hidden />
              </span>
              {t(key)}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-small text-muted-foreground">{t("footer", { year: new Date().getFullYear() })}</p>
    </div>
  );
}
