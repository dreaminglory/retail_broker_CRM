-- Create merge_history table
CREATE TABLE merge_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  winner_contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  loser_contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  merged_by UUID NOT NULL REFERENCES auth.users(id),
  merged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  loser_snapshot JSONB NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE merge_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency users can view merge history" 
ON merge_history FOR SELECT 
TO authenticated 
USING (
  agency_id = current_agency_id()
);

CREATE POLICY "Agency users can insert merge history" 
ON merge_history FOR INSERT 
TO authenticated 
WITH CHECK (
  agency_id = current_agency_id()
);
