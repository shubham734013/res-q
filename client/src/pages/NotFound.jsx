import { Link } from 'react-router-dom';
import { Button } from '../components/ui/index.jsx';

export function NotFoundPage() {
  return (
    <div className="py-16">
      <h1 className="text-3xl font-bold tracking-tight text-ink">That page does not exist</h1>
      <p className="mt-2 max-w-md text-ink-soft">
        The link may be out of date. Searching from scratch is usually quicker than fixing the URL.
      </p>
      <div className="mt-6 flex gap-2">
        <Button as={Link} to="/search">
          Find healthcare
        </Button>
        <Button as={Link} to="/emergency" variant="urgent">
          Emergency Mode
        </Button>
      </div>
    </div>
  );
}
