import Link from "next/link";
import { Home } from "lucide-react";
import type { TaskProperty } from "@/domain/tasks/types";
import { propertyCode } from "@/components/domain/properties/property-labels";

/** "#1042 · ул. Кричим 12" under a viewing task, linking to the property. */
export function TaskPropertyLine({ property }: { property: TaskProperty }) {
  return (
    <Link
      href={`/properties/${property.id}`}
      className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground transition-colors hover:text-primary"
    >
      <Home className="h-3 w-3 shrink-0" />
      <span className="font-mono">{propertyCode(property)}</span>
      {property.address && <span className="truncate">· {property.address}</span>}
    </Link>
  );
}
