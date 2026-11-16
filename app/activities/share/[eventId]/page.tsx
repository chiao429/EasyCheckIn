import { PublicActivityList } from '@/components/PublicActivityList';

export const dynamic = 'force-dynamic';

export default function SharedActivityPage({ params, searchParams }: {
  params: { eventId: string };
  searchParams: { configId?: string };
}) {
  return <PublicActivityList onlyEventId={params.eventId} configId={searchParams.configId} standalone />;
}
