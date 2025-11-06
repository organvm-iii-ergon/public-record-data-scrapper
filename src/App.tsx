import { useEffect, useState } from 'react';
import ProspectCard from '@/components/ProspectCard';
import { loadProspects } from '@/lib/csvLoader';

export default function App() {
  const [prospects, setProspects] = useState([]);

  useEffect(() => {
    async function load() {
      const rows = await loadProspects();
      setProspects(rows);
    }
    load();
  }, []);

  return (
    <div className="prospect-list">
      {prospects.map((p, index) => (
        <ProspectCard key={index} data={p} />
      ))}
    </div>
  );
}

