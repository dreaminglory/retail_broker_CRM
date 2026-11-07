import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import type { ListScope, SmartListEntity } from "@/domain/smart-lists/types";
import { ScopeToggle } from "./scope-toggle";

type ListPageHeaderProps = {
  listId: string;
  name: string;
  entity: SmartListEntity;
  /** Null when the list can't run (a stale saved filter). */
  total: number | null;
  scope: ListScope;
  /** The Mine / Agency toggle: owners and managers, on a built-in list that has an owner. */
  showScopeToggle: boolean;
  /** Buttons for the list (Work through, and later the saved-list controls). */
  actions?: React.ReactNode;
};

export function ListPageHeader({ listId, name, entity, total, scope, showScopeToggle, actions }: ListPageHeaderProps) {
  const t = useTranslations("smartLists.page");

  return (
    <div className="mb-6">
      <Link
        href={scope === "agency" ? "/lists?scope=agency" : "/lists"}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("back")}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold tracking-tight">{name}</h1>
          {total !== null && (
            <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
              {t(entity === "opportunity" ? "dealCount" : "inquiryCount", { count: total })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showScopeToggle && <ScopeToggle scope={scope} basePath={`/lists/${listId}`} />}
          {actions}
        </div>
      </div>
    </div>
  );
}
