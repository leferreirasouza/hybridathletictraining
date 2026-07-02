import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import type { CalendarProvider } from '@/lib/calendarExport';

const PROVIDER_LABELS: Record<CalendarProvider, string> = {
  google: 'Google Calendar',
  outlook: 'Outlook Calendar',
  apple: 'Apple Calendar (.ics)',
};

/** Shared provider list for "add to calendar" dropdowns — was hand-duplicated across Schedule.tsx (x2) and SessionCard.tsx. */
export function CalendarProviderMenuItems({ onSelect }: { onSelect: (provider: CalendarProvider) => void }) {
  return (
    <>
      {(Object.keys(PROVIDER_LABELS) as CalendarProvider[]).map((provider) => (
        <DropdownMenuItem key={provider} onClick={() => onSelect(provider)}>
          {PROVIDER_LABELS[provider]}
        </DropdownMenuItem>
      ))}
    </>
  );
}
