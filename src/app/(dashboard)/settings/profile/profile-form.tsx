'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateProfile } from './actions';
import { toast } from 'sonner';

interface ProfileFormProps {
  currentDisplayName: string;
}

export function ProfileForm({ currentDisplayName }: ProfileFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDirty = displayName.trim() !== currentDisplayName;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData();
    formData.set('display_name', displayName);

    try {
      const result = await updateProfile(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Profile updated successfully');
        router.refresh();
      }
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="display_name">Display Name</Label>
        <Input
          id="display_name"
          name="display_name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Enter your display name"
          minLength={2}
          maxLength={100}
          required
        />
        <p className="text-xs text-muted-foreground">
          This is the name that appears on notes, tasks, and timeline entries.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={!isDirty || isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
