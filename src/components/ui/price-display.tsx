import * as React from "react"
import { cn } from "@/lib/utils"

interface PriceDisplayProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  currency?: string;
  locale?: string;
}

export function PriceDisplay({
  value,
  currency = "EUR",
  locale = "bg-BG",
  className,
  ...props
}: PriceDisplayProps) {
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 0,
  }).format(value);

  return (
    <span className={cn("font-medium", className)} {...props}>
      {formatted}
    </span>
  );
}
