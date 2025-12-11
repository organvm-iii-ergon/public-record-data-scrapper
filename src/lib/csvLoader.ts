export async function loadProspects() {
  const res = await fetch('/ucc_enriched.csv');
  const text = await res.text();

  const rows = text.trim().split('\n');
  const headers = rows.shift()!.split(',');

  return rows.map((row) => {
    const values = row.split(',');
    return Object.fromEntries(headers.map((h, i) => [h.trim(), values[i]?.trim()]));
  });
}

