"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PropertyForm } from "@/components/domain/properties/property-form";
import type { ActiveBroker } from "@/domain/members/types";
import { createPropertyAction, createSubjectPropertyAction } from "../actions";

/** The seller or landlord deal a new property is created for (spec: properties, cut 3). */
export type SubjectOf = { id: string; title: string; ownerName: string | null };

export function NewPropertyClient({
  brokers,
  currentUserId,
  subjectOf = null,
}: {
  brokers: ActiveBroker[];
  currentUserId: string;
  subjectOf?: SubjectOf | null;
}) {
  const router = useRouter();
  const action = useMemo(
    () => (subjectOf ? createSubjectPropertyAction.bind(null, subjectOf.id) : createPropertyAction),
    [subjectOf]
  );
  // From a deal, saving returns to the deal; otherwise it opens the new property.
  const done = useCallback(
    (id: string) => router.push(subjectOf ? `/opportunities/${subjectOf.id}` : `/properties/${id}`),
    [router, subjectOf]
  );

  return (
    <PropertyForm
      brokers={brokers}
      defaultAssignee={currentUserId}
      action={action}
      onSuccess={done}
      onCancel={() => router.push(subjectOf ? `/opportunities/${subjectOf.id}` : "/properties")}
    />
  );
}
