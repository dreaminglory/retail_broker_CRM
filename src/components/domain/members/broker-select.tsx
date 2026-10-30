"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActiveBroker } from "@/domain/members/types";
import { NONE_SELECT_VALUE } from "@/lib/validation";
import { useTranslations } from "next-intl";

export interface BrokerSelectProps {
  name?: string;
  brokers: ActiveBroker[];
  defaultValue?: string | null;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  allowUnassigned?: boolean;
  ariaLabel?: string;
}

export function BrokerSelect({
  name,
  brokers,
  defaultValue,
  value,
  onValueChange,
  placeholder = "Select broker...",
  required,
  disabled,
  allowUnassigned = true,
  ariaLabel,
}: BrokerSelectProps) {
  const enums = useTranslations("Enums");
  // null means unassigned. The sentinel is submitted as-is and mapped back to
  // null by nullableUuid() in the domain schemas.
  const mappedDefault = defaultValue === null ? NONE_SELECT_VALUE : defaultValue;

  return (
    <Select
      name={name}
      defaultValue={mappedDefault}
      value={value}
      onValueChange={(v) => onValueChange?.(v as string)}
      required={required}
      disabled={disabled}
    >
      <SelectTrigger aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder}>
          {(val: string | null) => {
            if (val === NONE_SELECT_VALUE) return enums("unassigned");
            if (!val) return placeholder;
            return brokers.find((b) => b.id === val)?.display_name ?? placeholder;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowUnassigned && (
          <SelectItem value={NONE_SELECT_VALUE} className="italic text-muted-foreground">
            {enums("unassigned")}
          </SelectItem>
        )}
        {brokers.map((broker) => (
          <SelectItem key={broker.id} value={broker.id}>
            {broker.display_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
