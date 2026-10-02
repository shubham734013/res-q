import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { facilityService } from '../services/index.js';
import { FacilityCard } from '../components/FacilityCard.jsx';
import { EmptyState, ErrorState, FacilitySkeleton } from '../components/States.jsx';
import { Button } from '../components/ui/index.jsx';

export function SavedPage() {
  const queryClient = useQueryClient();

  const saved = useQuery({ queryKey: ['saved'], queryFn: facilityService.saved });

  const unsave = useMutation({
    mutationFn: (facility) => facilityService.unsave(facility.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved'] }),
  });

  const items = saved.data?.items ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Saved facilities</h1>
        <p className="mt-1 text-ink-soft">
          Distances are not shown here — you may be nowhere near these right now.
        </p>
      </div>

      {saved.isPending && <FacilitySkeleton />}
      {saved.isError && <ErrorState error={saved.error} onRetry={saved.refetch} />}

      {saved.isSuccess && items.length === 0 && (
        <EmptyState
          title="No saved facilities yet"
          body="Save a hospital from its details page and it will be here next time."
          action={
            <Button as={Link} to="/search" variant="secondary">
              Find healthcare
            </Button>
          }
        />
      )}

      {items.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {items.map((facility) => (
            <FacilityCard
              key={facility.id}
              facility={facility}
              isSaved
              onSave={unsave.mutate}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
