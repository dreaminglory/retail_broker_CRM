"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { PropertyForm } from "@/components/domain/properties/property-form";
import type { Area } from "@/domain/areas/types";
import type { ActiveBroker } from "@/domain/members/types";
import type { PropertyDetail } from "@/domain/properties/types";
import { updatePropertyAction } from "../../actions";

type EditPropertyClientProps = {
  property: PropertyDetail;
  areas: Pick<Area, "id" | "name">[];
  brokers: ActiveBroker[];
};

export function EditPropertyClient({ property, areas, brokers }: EditPropertyClientProps) {
  const router = useRouter();
  const backToProperty = useCallback(() => router.push(`/properties/${property.id}`), [router, property.id]);

  return (
    <PropertyForm
      property={property}
      settlement={property.settlement}
      areas={areas}
      brokers={brokers}
      defaultAssignee={property.assigned_to ?? ""}
      action={updatePropertyAction.bind(null, property.id)}
      onSuccess={backToProperty}
      onCancel={backToProperty}
    />
  );
}
