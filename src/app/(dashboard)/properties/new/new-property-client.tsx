"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { PropertyForm } from "@/components/domain/properties/property-form";
import type { ActiveBroker } from "@/domain/members/types";
import { createPropertyAction } from "../actions";

export function NewPropertyClient({ brokers, currentUserId }: { brokers: ActiveBroker[]; currentUserId: string }) {
  const router = useRouter();
  const openProperty = useCallback((id: string) => router.push(`/properties/${id}`), [router]);

  return (
    <PropertyForm
      brokers={brokers}
      defaultAssignee={currentUserId}
      action={createPropertyAction}
      onSuccess={openProperty}
      onCancel={() => router.push("/properties")}
    />
  );
}
