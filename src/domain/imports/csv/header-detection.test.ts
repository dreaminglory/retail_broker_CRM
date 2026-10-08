import { describe, it, expect } from "vitest";
import { detectHeaders } from "./header-detection";

describe("detectHeaders", () => {
  it("detects English headers", () => {
    const headers = ["First Name", "Last Name", "Email Address", "Phone Number", "Company", "Notes"];
    const mapping = detectHeaders(headers);
    expect(mapping.first_name).toBe("First Name");
    expect(mapping.last_name).toBe("Last Name");
    expect(mapping.email).toBe("Email Address");
    expect(mapping.phone).toBe("Phone Number");
    expect(mapping.company_name).toBe("Company");
    expect(mapping.note).toBe("Notes");
  });

  it("detects Bulgarian headers", () => {
    const headers = ["Име", "Фамилия", "Имейл", "Телефон", "Фирма"];
    const mapping = detectHeaders(headers);
    console.log("BULGARIAN MAPPING:", mapping);
    expect(mapping.first_name).toBe("Име");
    expect(mapping.last_name).toBe("Фамилия");
    expect(mapping.email).toBe("Имейл");
    expect(mapping.phone).toBe("Телефон");
    expect(mapping.company_name).toBe("Фирма");
  });

  it("detects Full Name", () => {
    const headers = ["Пълно име", "Име и Фамилия", "Full Name"];
    const mapping = detectHeaders(headers);
    expect(mapping.full_name).toBe("Пълно име"); // First match wins based on the order in the synonyms list
  });

  it("handles empty headers and unknowns", () => {
    const headers = ["", "Unknown Field", "Something Else"];
    const mapping = detectHeaders(headers);
    expect(Object.keys(mapping).length).toBe(0);
  });
});
