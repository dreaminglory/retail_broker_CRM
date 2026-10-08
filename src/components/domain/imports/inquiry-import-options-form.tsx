"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InquiryImportOptionsInput } from "@/domain/imports/validation";

interface InquiryImportOptionsFormProps {
  options: InquiryImportOptionsInput;
  onChange: (options: InquiryImportOptionsInput) => void;
}

export function InquiryImportOptionsForm({ options, onChange }: InquiryImportOptionsFormProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-medium">Contact Linking</h3>
        <p className="text-sm text-muted-foreground">
          How should we handle callers?
        </p>
        <div className="flex items-center space-x-2">
          <input 
            type="checkbox"
            id="link_contacts" 
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            checked={options.link_contacts}
            onChange={(e) => onChange({ ...options, link_contacts: e.target.checked })}
          />
          <Label htmlFor="link_contacts">Link to existing contacts (by phone/email)</Label>
        </div>
        <div className="flex items-center space-x-2">
          <input 
            type="checkbox"
            id="create_missing_contacts" 
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            checked={options.create_missing_contacts}
            onChange={(e) => onChange({ ...options, create_missing_contacts: e.target.checked })}
          />
          <Label htmlFor="create_missing_contacts">Create new contacts if no match found</Label>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-medium">Unknown Source Strategy</h3>
        <p className="text-sm text-muted-foreground">
          What happens if a Lead Source name from the CSV is not found in CRM?
        </p>
        <RadioGroup
          value={options.unknown_source}
          onValueChange={(val: "error" | "use_default") =>
            onChange({ ...options, unknown_source: val })
          }
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="error" id="error" />
            <Label htmlFor="error">Mark row as invalid (Error)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="default" id="default" />
            <Label htmlFor="default">Use default source</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-medium">Default Status</h3>
        <p className="text-sm text-muted-foreground">
          What status should imported inquiries have?
        </p>
        <Select 
          value={options.default_status} 
          onValueChange={(val: any) => onChange({ ...options, default_status: val })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
