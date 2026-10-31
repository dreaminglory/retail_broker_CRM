import { after } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { createMailer } from './mailer';
import { NotificationRepository } from './repository';
import { NotificationService } from './service';

/**
 * Runs notification work after the action's response (AD-042). Members can't write
 * `notification_deliveries`, so it uses the service role, and every query filters by
 * `agency_id` itself. Every failure is caught and logged: a failed email never fails the action.
 */
export function notifyAfterResponse(work: (notifications: NotificationService) => Promise<void>): void {
  after(async () => {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');
      if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is not set');
      await work(new NotificationService(new NotificationRepository(createSupabaseAdmin()), createMailer(), appUrl));
    } catch (error) {
      console.error('Notification failed after the response:', error);
    }
  });
}
