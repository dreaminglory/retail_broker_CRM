import { ContactImportOptionsInput } from "../validation";

export interface ContactCandidate {
  contact_type: "person" | "organization";
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  phone_2: string | null;
  email: string | null;
  email_2: string | null;
  viber: string | null;
  whatsapp: string | null;
  note: string | null;
  external_ref: string | null;
}

export function mapRowToCandidate(
  rawRow: Record<string, string>,
  mapping: Record<string, string | null>,
  options: ContactImportOptionsInput
): ContactCandidate {
  // Extract values using the mapping
  const getValue = (field: string): string | null => {
    const headerName = mapping[field];
    if (!headerName) return null;
    const value = rawRow[headerName];
    if (!value || value.trim() === "") return null;
    return value.trim();
  };

  const rawFullName = getValue("full_name");
  let firstName = getValue("first_name");
  let lastName = getValue("last_name");
  let companyName = getValue("company_name");
  const rawContactType = getValue("contact_type")?.toLowerCase();

  let contactType: "person" | "organization" = options.default_contact_type || "person";
  
  if (rawContactType) {
    if (["organization", "фирма", "company", "юридическо лице", "org"].includes(rawContactType)) {
      contactType = "organization";
    } else if (["person", "лице", "физическо лице", "individual"].includes(rawContactType)) {
      contactType = "person";
    }
  } else if (!firstName && !lastName && companyName) {
    // Infer organization if no person name but has company name
    contactType = "organization";
  }

  // Handle full name splitting if first/last are not explicitly provided
  if (rawFullName) {
    if (contactType === "organization" && !companyName) {
      // For organizations, treat full name as company name
      companyName = rawFullName;
    } else if (contactType === "person" && (!firstName && !lastName)) {
      const parts = rawFullName.split(/\s+/);
      if (parts.length > 0) {
        firstName = parts[0];
        if (parts.length > 1) {
          lastName = parts.slice(1).join(" ");
        }
      }
    }
  }

  return {
    contact_type: contactType,
    first_name: firstName,
    last_name: lastName,
    company_name: companyName,
    phone: getValue("phone"),
    phone_2: getValue("phone_2"),
    email: getValue("email"),
    email_2: getValue("email_2"),
    viber: getValue("viber"),
    whatsapp: getValue("whatsapp"),
    note: getValue("note"),
    external_ref: getValue("external_ref"),
  };
}

export interface InquiryCandidate {
  caller_name: string | null;
  caller_phone: string | null;
  caller_email: string | null;
  subject: string | null;
  description: string | null;
  source: string | null;
  external_ref: string | null;
  received_at: string | null;
  assigned_to: string | null;
  status: string | null;
}

export function mapRowToInquiryCandidate(
  rawRow: Record<string, string>,
  mapping: Record<string, string | null>
): InquiryCandidate {
  const getValue = (field: string): string | null => {
    const headerName = mapping[field];
    if (!headerName) return null;
    const value = rawRow[headerName];
    if (!value || value.trim() === "") return null;
    return value.trim();
  };

  return {
    caller_name: getValue("caller_name"),
    caller_phone: getValue("caller_phone"),
    caller_email: getValue("caller_email"),
    subject: getValue("subject"),
    description: getValue("description"),
    source: getValue("source"),
    external_ref: getValue("external_ref"),
    received_at: getValue("received_at"),
    assigned_to: getValue("assigned_to"),
    status: getValue("status"),
  };
}
