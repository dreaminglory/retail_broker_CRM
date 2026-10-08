import { describe, it, expect } from "vitest";
import { mapRowToCandidate } from "./row-mapper";

describe("mapRowToCandidate", () => {
  it("maps basic fields correctly", () => {
    const raw = {
      "F_Name": "John",
      "L_Name": "Doe",
      "E": "john@example.com",
    };
    const mapping = {
      first_name: "F_Name",
      last_name: "L_Name",
      email: "E",
    };
    const options = { duplicate_strategy: "skip" as const, default_contact_type: "person" as const };

    const candidate = mapRowToCandidate(raw, mapping, options);
    expect(candidate.first_name).toBe("John");
    expect(candidate.last_name).toBe("Doe");
    expect(candidate.email).toBe("john@example.com");
    expect(candidate.contact_type).toBe("person");
  });

  it("splits full name if first and last name are not mapped", () => {
    const raw = {
      "Name": "John von Doe",
    };
    const mapping = {
      full_name: "Name",
    };
    const options = { duplicate_strategy: "skip" as const, default_contact_type: "person" as const };

    const candidate = mapRowToCandidate(raw, mapping, options);
    expect(candidate.first_name).toBe("John");
    expect(candidate.last_name).toBe("von Doe");
  });

  it("detects organization type from company name", () => {
    const raw = {
      "Company": "Acme Corp Ltd.",
    };
    const mapping = {
      company_name: "Company",
    };
    const options = { duplicate_strategy: "skip" as const, default_contact_type: "person" as const };

    const candidate = mapRowToCandidate(raw, mapping, options);
    expect(candidate.company_name).toBe("Acme Corp Ltd.");
    expect(candidate.contact_type).toBe("organization"); // Because of Ltd. heuristic
  });

  it("prioritizes mapped contact type", () => {
    const raw = {
      "Type": "organization",
      "Name": "John Smith",
    };
    const mapping = {
      contact_type: "Type",
      full_name: "Name",
    };
    const options = { duplicate_strategy: "skip" as const, default_contact_type: "person" as const };

    const candidate = mapRowToCandidate(raw, mapping, options);
    expect(candidate.contact_type).toBe("organization");
    expect(candidate.company_name).toBe("John Smith"); // Full name maps to company for organization
  });
});
