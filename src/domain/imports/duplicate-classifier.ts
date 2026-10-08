import { ContactCandidate } from "./csv/row-mapper";
import { ImportRowStatus, MatchReason } from "./types";

export interface ExistingContactInfo {
  id: string;
  external_ref: string | null;
  display_name: string;
  emails: string[];
  phones: string[];
}

export interface ClassificationResult {
  status: ImportRowStatus;
  match_reason: MatchReason | null;
  matched_entity_id: string | null;
}

export function classifyDuplicates(
  candidates: ContactCandidate[],
  existingIndex: ExistingContactInfo[]
): ClassificationResult[] {
  const results: ClassificationResult[] = [];

  // Track what we've seen in the current file to detect in-file duplicates
  const seenExternalRefs = new Map<string, number>(); // external_ref -> index in candidates
  const seenEmails = new Map<string, number>();       // email -> index
  const seenPhones = new Map<string, number>();       // phone -> index

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    let isDuplicate = false;
    let matchReason: MatchReason | null = null;
    let matchedEntityId: string | null = null;
    let nameSimilar = false;

    // 1. Check DB external_ref
    if (candidate.external_ref) {
      const match = existingIndex.find(e => e.external_ref === candidate.external_ref);
      if (match) {
        isDuplicate = true;
        matchReason = "external_ref";
        matchedEntityId = match.id;
      }
    }

    // 2. Check DB emails
    if (!isDuplicate) {
      const candidateEmails = [candidate.email, candidate.email_2].filter(Boolean) as string[];
      for (const email of candidateEmails) {
        const match = existingIndex.find(e => e.emails.includes(email));
        if (match) {
          isDuplicate = true;
          matchReason = "email";
          matchedEntityId = match.id;
          break;
        }
      }
    }

    // 3. Check DB phones
    if (!isDuplicate) {
      const candidatePhones = [candidate.phone, candidate.phone_2].filter(Boolean) as string[];
      for (const phone of candidatePhones) {
        const match = existingIndex.find(e => e.phones.includes(phone));
        if (match) {
          isDuplicate = true;
          matchReason = "phone";
          matchedEntityId = match.id;
          break;
        }
      }
    }

    // 4. Check In-File Duplicates
    if (!isDuplicate) {
      if (candidate.external_ref && seenExternalRefs.has(candidate.external_ref)) {
        isDuplicate = true;
        matchReason = "in_file";
      } else if (candidate.external_ref) {
        seenExternalRefs.set(candidate.external_ref, i);
      }
    }

    if (!isDuplicate) {
      const candidateEmails = [candidate.email, candidate.email_2].filter(Boolean) as string[];
      for (const email of candidateEmails) {
        if (seenEmails.has(email)) {
          isDuplicate = true;
          matchReason = "in_file";
          break;
        } else {
          seenEmails.set(email, i);
        }
      }
    }

    if (!isDuplicate) {
      const candidatePhones = [candidate.phone, candidate.phone_2].filter(Boolean) as string[];
      for (const phone of candidatePhones) {
        if (seenPhones.has(phone)) {
          isDuplicate = true;
          matchReason = "in_file";
          break;
        } else {
          seenPhones.set(phone, i);
        }
      }
    }

    // 5. Check Name Similarity Warning (only if not already a hard duplicate)
    if (!isDuplicate) {
      const candDisplayName = candidate.contact_type === 'organization' 
        ? candidate.company_name 
        : `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim();
        
      if (candDisplayName) {
        const normalizedCandName = candDisplayName.toLowerCase();
        const match = existingIndex.find(e => e.display_name.toLowerCase() === normalizedCandName);
        if (match) {
          nameSimilar = true;
          matchReason = "name_similar";
          matchedEntityId = match.id;
        }
      }
    }

    if (isDuplicate) {
      results.push({
        status: "duplicate",
        match_reason: matchReason,
        matched_entity_id: matchedEntityId,
      });
    } else {
      results.push({
        status: "valid",
        match_reason: nameSimilar ? matchReason : null,
        matched_entity_id: nameSimilar ? matchedEntityId : null,
      });
    }
  }

  return results;
}
