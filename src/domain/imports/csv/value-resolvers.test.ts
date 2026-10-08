import { describe, it, expect } from "vitest";
import { resolveAssignee, resolveSource, resolveStatus } from "./value-resolvers";

describe("value-resolvers", () => {
  describe("resolveAssignee", () => {
    it("should resolve assignee by name", () => {
      const members = [
        { user_id: "1", display_name: "Ivan Ivanov", email: "ivan@test.com" }
      ];
      expect(resolveAssignee("Ivan Ivanov", members, null)).toBe("1");
    });
    
    it("should resolve assignee by email", () => {
      const members = [
        { user_id: "1", display_name: "Ivan Ivanov", email: "ivan@test.com" }
      ];
      expect(resolveAssignee("ivan@test.com", members, null)).toBe("1");
    });
    
    it("should fallback to default if not found", () => {
      const members = [
        { user_id: "1", display_name: "Ivan Ivanov", email: "ivan@test.com" }
      ];
      expect(resolveAssignee("Unknown", members, "2")).toBe("2");
    });
  });

  describe("resolveSource", () => {
    it("should resolve exact match", () => {
      const sources = [{ id: "1", name: "Imot.bg" }];
      expect(resolveSource("imot.bg", sources, null)).toBe("1");
    });
    
    it("should fallback to default if not found", () => {
      const sources = [{ id: "1", name: "Imot.bg" }];
      expect(resolveSource("Alo.bg", sources, "2")).toBe("2");
    });
  });
  
  describe("resolveStatus", () => {
    it("should map cyrillic synonyms to internal statuses", () => {
      expect(resolveStatus("Ново", "new")).toBe("new");
      expect(resolveStatus("Свързан", "new")).toBe("contacted");
    });
    
    it("should fallback to default", () => {
      expect(resolveStatus("Unknown", "contacted")).toBe("contacted");
      expect(resolveStatus(null, "new")).toBe("new");
    });
  });
});
