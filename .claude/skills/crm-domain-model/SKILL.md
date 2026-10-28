---
name: crm-domain-model
description: BrokerCRM domain rules — entities, relationships, lifecycles (inquiry, opportunity, task, membership, import), invariants with where they are enforced, Today/Exceptions definitions and the EN/BG glossary. Use before adding or changing a table, status, business rule, form or screen, and when a question depends on how the CRM's entities relate.
---

# CRM domain model

The model lives in **`docs/domain-model.md`**. Read the sections you need before writing code:

| Task | Read |
|---|---|
| New or changed table | §1 context map, the area's ER diagram in §2, §5 invariants |
| New status or workflow step | §3 lifecycles, §5 |
| Today or manager screen | §4 derived views |
| UI strings, naming | §7 glossary (canonical BG term) |
| Anything that "should already be true" | §5 invariants, §6 known gaps |

## While working

1. Find the invariant you are touching in §5 and check its "Enforced by" layer. Change
   and test that layer; don't add a second check somewhere else.
2. A new rule goes in the strongest layer that fits: DB constraint, index or trigger, then
   Zod, then the service. "Convention" is a last resort, and you must say so.
3. Status values are DB `CHECK` lists, mirrored as Zod enums and TS types. Change all
   three together, plus `messages/{bg,en}.json`.
4. If the code contradicts the doc, trust the code, then fix the doc or add the
   contradiction to §6.

## Before finishing

Update `docs/domain-model.md` in the same change, following §8 "How to extend": the ER
diagram, any lifecycle, invariants, glossary, and the migration count in the header.
