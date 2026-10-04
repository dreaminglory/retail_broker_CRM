---
name: crm-domain-model
description: Reference guide for the CRM domain model — entity relationships, business rules, lifecycle flows, and invariants. Use when creating database tables, writing business logic, building forms, or making domain modeling decisions.
---

# CRM Domain Model Reference

## Entity Hierarchy

```
Agency (tenant)
├── AgencyMembership (user ↔ agency link, with role)
├── LeadSource (configurable source taxonomy)
├── Pipeline (configurable, e.g., "Sales Pipeline")
│   └── Stage (ordered steps: New → Qualified → Active → Won/Lost)
├── Contact (durable person or organization)
│   └── ContactMethod (phone, email — multiple per contact)
├── Inquiry (original inbound event, immutable source record)
├── Opportunity (commercial pursuit — the core business entity)
│   ├── OpportunityParticipant (contact or user with a role)
│   ├── Task (owned follow-up action with due time)
│   └── Activity (timeline event records)
└── MergeHistory (duplicate resolution audit trail)
```

## Key Business Rules (Invariants)

### Contact Rules
- A Contact is a durable person — it survives opportunity completion
- One Contact can have multiple concurrent Opportunities
- Phone numbers stored in E.164 format (+359XXXXXXXXX for Bulgaria)
- Emails stored lowercase
- Before creating a Contact, always search for duplicates by phone and email

### Opportunity Rules
- Pipeline stage belongs to the OPPORTUNITY, never the Contact
- Every active Opportunity MUST have an assigned owner (broker)
- Every active Opportunity SHOULD have a next action (Task) with a due date
- If `next_action_at` is NULL or past due on an active Opportunity → flagged as "at risk"
- An Opportunity can be: buyer, seller, landlord, tenant
- An Opportunity preserves its source Inquiry reference

### Task Rules
- A Task has: owner, due datetime, status (pending/completed/cancelled), outcome
- Completing a Task requires recording an outcome AND either:
  - Scheduling the next Task, OR
  - Advancing the Opportunity stage, OR
  - Closing the Opportunity (Won/Lost)
- Overdue = due datetime is in the past AND status is still "pending"

### Inquiry Rules
- An Inquiry is an immutable inbound event — never deleted or modified after creation
- An Inquiry links to a Contact (matched or created) and an Opportunity
- Original source data is preserved in raw_payload (JSONB)

## Stage Lifecycle
```
New → Attempting Contact → Qualified → Active → Viewing → Offer → Negotiation → Won
                                                                                  ↘ Lost
                                                                          Nurture ↗
```
Stages are configurable per agency. The above is the default template.

## Today Screen Queries
The Today Screen shows a broker's daily work in priority order:
1. **New / Uncontacted:** Inquiries assigned to this broker with no recorded outreach
2. **Overdue:** Tasks past due date, still pending
3. **Due Today:** Tasks due today
4. **Coming Up:** Tasks due in the next 3 days
5. **At Risk:** Active opportunities with no scheduled next action

## Manager Exception Queries
The Manager Dashboard highlights operational problems:
1. **Unassigned Inquiries:** Inquiries with no broker assigned
2. **Overdue Tasks:** By broker, sorted by most overdue
3. **No Next Action:** Active opportunities with no pending task
4. **Stale Opportunities:** Active opportunities with no activity in X days
5. **Workload Distribution:** Task/opportunity count per broker
