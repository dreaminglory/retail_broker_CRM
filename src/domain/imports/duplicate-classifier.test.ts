import { describe, it, expect } from "vitest";
import { classifyDuplicates, ExistingContactInfo } from "./duplicate-classifier";
import { ContactCandidate } from "./csv/row-mapper";

describe("classifyDuplicates", () => {
  it("identifies DB exact matches", () => {
    const candidates: ContactCandidate[] = [
      {
        contact_type: "person",
        first_name: "John",
        last_name: "Doe",
        company_name: null,
        phone: "+359888123456",
        phone_2: null,
        email: null,
        email_2: null,
        viber: null,
        whatsapp: null,
        note: null,
        external_ref: null,
      }
    ];

    const dbIndex: ExistingContactInfo[] = [
      {
        id: "contact-1",
        display_name: "John Doe",
        phones: ["+359888123456"],
        emails: [],
        external_ref: null,
      }
    ];

    const results = classifyDuplicates(candidates, dbIndex);
    expect(results[0].status).toBe("duplicate");
    expect(results[0].match_reason).toBe("phone");
    expect(results[0].matched_entity_id).toBe("contact-1");
  });

  it("identifies in-file duplicates", () => {
    const candidates: ContactCandidate[] = [
      {
        contact_type: "person",
        first_name: "John",
        last_name: "Doe",
        company_name: null,
        phone: null,
        phone_2: null,
        email: "john@example.com",
        email_2: null,
        viber: null,
        whatsapp: null,
        note: null,
        external_ref: null,
      },
      {
        contact_type: "person",
        first_name: "John",
        last_name: "Doe",
        company_name: null,
        phone: null,
        phone_2: null,
        email: "john@example.com",
        email_2: null,
        viber: null,
        whatsapp: null,
        note: null,
        external_ref: null,
      }
    ];

    const results = classifyDuplicates(candidates, []);
    expect(results[0].status).toBe("valid");
    expect(results[1].status).toBe("duplicate");
    expect(results[1].match_reason).toBe("in_file");
  });

  it("identifies name-similar warnings", () => {
    const candidates: ContactCandidate[] = [
      {
        contact_type: "person",
        first_name: "John",
        last_name: "Doe",
        company_name: null,
        phone: "+359888654321", // Different phone
        phone_2: null,
        email: null,
        email_2: null,
        viber: null,
        whatsapp: null,
        note: null,
        external_ref: null,
      }
    ];

    const dbIndex: ExistingContactInfo[] = [
      {
        id: "contact-1",
        display_name: "John Doe",
        phones: ["+359888123456"],
        emails: [],
        external_ref: null,
      }
    ];

    const results = classifyDuplicates(candidates, dbIndex);
    // Because it's a name match, it should be marked as duplicate with a warning reason.
    // Wait, name matches are flagged as duplicate with 'name_similar' reason. Let's check.
    expect(results[0].status).toBe("valid");
    expect(results[0].match_reason).toBe("name_similar");
  });

  it("marks as valid if no matches", () => {
    const candidates: ContactCandidate[] = [
      {
        contact_type: "person",
        first_name: "Jane",
        last_name: "Smith",
        company_name: null,
        phone: "+359888999888",
        phone_2: null,
        email: "jane@example.com",
        email_2: null,
        viber: null,
        whatsapp: null,
        note: null,
        external_ref: null,
      }
    ];

    const results = classifyDuplicates(candidates, []);
    expect(results[0].status).toBe("valid");
    expect(results[0].match_reason).toBeNull();
  });
});
