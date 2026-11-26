"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { hrefWithParam } from "./url-state";

/**
 * One search param as state. Setting it replaces the URL, so the Server Component sees the new
 * value too (a master-detail panel loads from it).
 */
export function useUrlParam(key: string): [string | null, (value: string | null) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(key);
  const setValue = useCallback(
    (next: string | null) => {
      router.replace(hrefWithParam(pathname, searchParams.toString(), key, next), { scroll: false });
    },
    [router, pathname, searchParams, key],
  );
  return [value, setValue];
}
