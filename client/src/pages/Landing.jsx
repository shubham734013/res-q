/**
 * ResQ — landing.
 *
 * The hero is the tool itself. Someone arriving here is usually mid-decision,
 * so the first interactive thing on the page is "where are you" followed by the
 * two ways out: search, or emergency.
 */

import { Link, useNavigate } from 'react-router-dom';
import { LocationPicker } from '../components/LocationPicker.jsx';
import { useLocation } from '../context/LocationContext.jsx';
import { Button } from '../components/ui/index.jsx';

const WHAT_IT_DOES = [
  {
    title: 'Find a facility that can actually help',
    body: 'Filter by department, emergency capability and distance, so you are not calling hospitals one by one.',
  },
  {
    title: 'See how current the information is',
    body: 'Every listing shows when it was last updated and who said so. Where nobody has told us, it says so instead of guessing.',
  },
  {
    title: 'Move fast when it matters',
    body: 'Emergency Mode strips the interface down to the nearest emergency departments, with call and directions one tap away.',
  },
];

export function LandingPage() {
  const { hasLocation } = useLocation();
  const navigate = useNavigate();

  return (
    <div className="space-y-12">
      <section className="pt-4">
        <h1 className="max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl">
          Find the right healthcare facility when every minute matters.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-ink-soft">
          Nearby hospitals, emergency departments, blood banks and ambulance providers — with
          honest information about how current each listing is.
        </p>

        <div className="mt-7 max-w-2xl">
          <LocationPicker />

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="flex-1"
              onClick={() => navigate('/search')}
              disabled={!hasLocation}
            >
              Find healthcare
            </Button>
            <Button as={Link} to="/emergency" size="lg" variant="urgent" className="flex-1">
              Emergency Mode
            </Button>
          </div>

          {!hasLocation && (
            <p className="mt-2 text-sm text-muted">
              Choose an area or share your location to start searching. Emergency Mode works
              either way.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="what" className="border-t border-line pt-8">
        <h2 id="what" className="text-2xl font-semibold text-ink">
          What ResQ does
        </h2>
        <div className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-3">
          {WHAT_IT_DOES.map((item) => (
            <div key={item.title}>
              <h3 className="font-semibold text-ink">{item.title}</h3>
              <p className="mt-1.5 text-ink-soft">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="limits" className="border-t border-line pt-8">
        <h2 id="limits" className="text-2xl font-semibold text-ink">
          What ResQ does not do
        </h2>
        <p className="mt-3 max-w-2xl text-ink-soft">
          ResQ is a navigation and information tool. It does not diagnose conditions, recommend
          treatment, reserve beds or dispatch ambulances. Availability shown here is a report from
          a source, not a guarantee — call ahead when you can. In a life-threatening emergency,
          contact your local emergency service first.
        </p>
      </section>
    </div>
  );
}
