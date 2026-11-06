"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ContactOption } from "@/domain/contacts/types";
import type { JoinableOpportunity } from "@/domain/inquiries/types";
import type { ActionResult } from "@/lib/actions";
import { parseAgencyLocal, toAgencyLocalInput } from "@/lib/time/agency-day";
import type { CallBackDraft } from "./join-opportunity-step";

export type JoinResult = ActionResult<{ opportunityId: string; reactivated: boolean }>;

export type JoinAction = (id: string, prevState: ActionResult, formData: FormData) => Promise<JoinResult>;

const INITIAL_JOIN_STATE: JoinResult = { success: false, error: "" };
const HOUR_MS = 3_600_000;

type UseJoinOpportunityArgs = {
  inquiryId: string;
  joinAction: JoinAction;
  listJoinableAction: (contactId: string) => Promise<ActionResult<JoinableOpportunity[]>>;
  timeZone: string;
  /** Default call-back title, already translated. */
  defaultCallBackTitle: string;
  onJoined: (opportunityId: string) => void;
};

/**
 * The convert dialog's "join an existing opportunity" state (AD-061): the chosen contact's open
 * deals, the deal and call back the broker picked, and the join action. The broker always picks
 * the deal; nothing is pre-selected.
 */
export function useJoinOpportunity({
  inquiryId,
  joinAction,
  listJoinableAction,
  timeZone,
  defaultCallBackTitle,
  onJoined,
}: UseJoinOpportunityArgs) {
  const [joinState, joinFormAction, joinPending] = useActionState(
    joinAction.bind(null, inquiryId) as (prevState: JoinResult, formData: FormData) => Promise<JoinResult>,
    INITIAL_JOIN_STATE
  );

  const [mode, setMode] = useState<"new" | "join">("new");
  const [deals, setDeals] = useState<JoinableOpportunity[]>([]);
  const [dealsStatus, setDealsStatus] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [callBack, setCallBack] = useState<CallBackDraft>({ enabled: true, title: "", due: "" });
  const dealsRequest = useRef(0);
  const handledJoin = useRef<JoinResult | null>(null);

  const joining = mode === "join";
  const callBackDue = callBack.enabled ? parseAgencyLocal(callBack.due, timeZone) : null;
  const callBackInvalid = joining && callBack.enabled && (!callBackDue || !callBack.title.trim());
  const taskJson =
    joining && callBack.enabled && callBackDue
      ? JSON.stringify({ title: callBack.title.trim(), due_at: callBackDue.toISOString() })
      : "";

  /** Why the Join button is disabled, as a key under ConvertInquiryDialog; null when it isn't. */
  const blocker: "joinNeedsDeal" | "joinNeedsCallBack" | null = !joining
    ? null
    : !selectedDealId
      ? "joinNeedsDeal"
      : callBackInvalid
        ? "joinNeedsCallBack"
        : null;

  /** A contact was picked (or cleared): load their open deals and go back to "new". */
  function loadDealsFor(contact: ContactOption | null) {
    setMode("new");
    setDeals([]);
    setSelectedDealId(null);
    const request = ++dealsRequest.current;
    if (!contact) {
      setDealsStatus("idle");
      return;
    }
    setDealsStatus("loading");
    listJoinableAction(contact.id)
      .then((result) => {
        if (request !== dealsRequest.current) return;
        setDeals(result.success ? result.data : []);
        setDealsStatus(result.success ? "ready" : "failed");
      })
      .catch(() => {
        if (request === dealsRequest.current) setDealsStatus("failed");
      });
  }

  function chooseMode(next: "new" | "join") {
    setMode(next);
    if (next !== "join") return;
    setCallBack((prev) => ({
      ...prev,
      title: prev.title || defaultCallBackTitle,
      due: prev.due || toAgencyLocalInput(new Date(Date.now() + HOUR_MS).toISOString(), timeZone),
    }));
  }

  // The joined deal is the destination, once per result.
  useEffect(() => {
    if (!joinState.success || !joinState.data || handledJoin.current === joinState) return;
    handledJoin.current = joinState;
    onJoined(joinState.data.opportunityId);
  }, [joinState, onJoined]);

  return {
    joining,
    joinState,
    joinFormAction,
    joinPending,
    deals,
    dealsStatus,
    selectedDealId,
    setSelectedDealId,
    callBack,
    setCallBack,
    taskJson,
    blocker,
    loadDealsFor,
    chooseMode,
    backToNew: () => setMode("new"),
  };
}
