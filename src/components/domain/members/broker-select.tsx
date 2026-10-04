"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActiveBroker } from "@/domain/members/types";

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
}: BrokerSelectProps) {
  // Translate null/undefined defaultValue to "none" if we allow unassigned
  const mappedDefault = defaultValue === null ? "none" : defaultValue;

  return (
    <Select
      name={name}
      defaultValue={mappedDefault}
      value={value}
      onValueChange={(v) => onValueChange?.(v as string)}
      required={required}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder}>
          {(val: string | null) => {
            if (val === "none") return "Unassigned";
            if (!val) return placeholder;
            return brokers.find((b) => b.id === val)?.display_name ?? placeholder;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowUnassigned && (
          <SelectItem value="none" className="italic text-muted-foreground">
            Unassigned
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
