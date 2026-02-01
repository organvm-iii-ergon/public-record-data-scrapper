import { useSafeKV as useKV } from '@/hooks/useSparkKV'
import type { DataTier } from '@public-records/core'

const DEFAULT_DATA_TIER: DataTier = 'oss'

export function useDataTier() {
  const [dataTier, setDataTier] = useKV<DataTier>('data-tier', DEFAULT_DATA_TIER)

  return {
    dataTier: dataTier ?? DEFAULT_DATA_TIER,
    setDataTier
  }
}
