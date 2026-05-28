import { CloudOff } from 'lucide-react';
import { useApiStatus } from '@/api/status';
import './ApiOfflineBanner.css';

/** Slim banner shown when live API calls fail (e.g. CORS in dev). */
export function ApiOfflineBanner() {
  const status = useApiStatus();
  if (status !== 'offline') return null;
  return (
    <output className="api-offline">
      <CloudOff size={15} />
      <span>Showing sample data, couldn’t reach the live API.</span>
    </output>
  );
}
