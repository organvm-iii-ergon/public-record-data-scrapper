import React, { useEffect, useState } from 'react';
import ProspectCard from '@/components/ProspectCard';
import { loadProspects } from '@/lib/csvLoader';

export default function AgenticDashboard() {
  const [prospects, setProspects] = useState([]);

  useEffect(() => {
    async function fetch() {
      const rows = await loadProspects();
      setProspects(rows);
    }
    fetch();
  }, []);

  return (
    <div className="dashboard">
      {prospects.map((row, i) => (
        <ProspectCard key={i} data={row} />
      ))}
    </div>
  );
}

