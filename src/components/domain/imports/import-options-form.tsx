"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ContactImportOptionsInput } from "@/domain/imports/validation";

interface ImportOptionsFormProps {
  options: ContactImportOptionsInput;
  onChange: (options: ContactImportOptionsInput) => void;
}

export function ImportOptionsForm({ options, onChange }: ImportOptionsFormProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Duplicate Strategy</h3>
        <p className="text-sm text-muted-foreground">
          What should happen if a contact in the file already exists in the CRM (matched by phone, email, or external ID)?
        </p>
        <RadioGroup
          value={options.duplicate_strategy}
          onValueChange={(val: "skip" | "update" | "create") =>
            onChange({ ...options, duplicate_strategy: val })
          }
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="skip" id="skip" />
            <Label htmlFor="skip">Skip duplicates (Recommended)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="update" id="update" />
            <Label htmlFor="update">Add missing details to existing contacts</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="create" id="create" />
            <Label htmlFor="create">Create anyway (Allow duplicates)</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-medium">Default Contact Type</h3>
        <p className="text-sm text-muted-foreground">
          If a row doesn't specify a type, what should it be imported as?
        </p>
        <RadioGroup
          value={options.default_contact_type}
          onValueChange={(val: "person" | "organization") =>
            onChange({ ...options, default_contact_type: val })
          }
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="person" id="person" />
            <Label htmlFor="person">Person</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="organization" id="organization" />
            <Label htmlFor="organization">Organization</Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
