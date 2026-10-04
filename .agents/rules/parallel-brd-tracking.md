# Parallel BRD Tracking

## Reminder
The BRD document (`docs/BRD.md`) is being populated incrementally alongside development.
This is NOT a traditional "write BRD first, then build" waterfall approach.

## When to Update the BRD
After completing any of these activities, check if the BRD needs a corresponding update:
- A new database table/migration is created → Update "Data Model" section
- A new screen/page is built → Update "Functional Requirements" section
- A business rule is implemented → Update "Business Rules" section
- A new API/server action is created → Update relevant requirement
- A user story is implemented → Mark it as complete in the BRD
- A design decision is made → Record it in `docs/decisions-log.md`

## What the BRD Tracks
- Numbered functional requirements (FR-INQ-001, FR-CON-001, etc.)
- User stories with acceptance criteria
- Non-functional requirements
- Data model specifications
- Business rules and validation rules
- Open decisions and assumptions

## How to Remind
When completing a sprint or significant feature, proactively say:
"This feature should be documented in the BRD. Shall I update docs/BRD.md?"
