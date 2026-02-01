import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@public-records/ui/select'
import { ArrowUp, ArrowDown, ListNumbers } from '@phosphor-icons/react'
import { Button } from '@public-records/ui/button'

export type SortField =
  | 'priorityScore'
  | 'healthScore'
  | 'signalCount'
  | 'defaultAge'
  | 'companyName'
export type SortDirection = 'asc' | 'desc'

interface SortControlsProps {
  sortField: SortField
  sortDirection: SortDirection
  onSortChange: (field: SortField, direction: SortDirection) => void
}

export function SortControls({ sortField, sortDirection, onSortChange }: SortControlsProps) {
  const toggleDirection = () => {
    onSortChange(sortField, sortDirection === 'asc' ? 'desc' : 'asc')
  }

  return (
    <div className="flex items-center gap-2">
      <ListNumbers size={14} className="text-white/70 sm:w-4 sm:h-4" />
      <Select
        value={sortField}
        onValueChange={(val) => onSortChange(val as SortField, sortDirection)}
      >
        <SelectTrigger
          className="w-[140px] sm:w-[180px] glass-effect border-white/30 text-white h-8 sm:h-10 text-xs sm:text-sm"
          aria-label="Sort by"
        >
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent className="glass-effect border-white/30">
          <SelectItem value="priorityScore">Priority Score</SelectItem>
          <SelectItem value="healthScore">Health Score</SelectItem>
          <SelectItem value="signalCount">Growth Signals</SelectItem>
          <SelectItem value="defaultAge">Default Age</SelectItem>
          <SelectItem value="companyName">Company Name</SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        onClick={toggleDirection}
        className="glass-effect border-white/30 h-8 w-8 sm:h-10 sm:w-10"
        aria-label={sortDirection === 'desc' ? 'Sort ascending' : 'Sort descending'}
      >
        {sortDirection === 'desc' ? (
          <ArrowDown size={14} weight="bold" className="sm:w-4 sm:h-4" />
        ) : (
          <ArrowUp size={14} weight="bold" className="sm:w-4 sm:h-4" />
        )}
      </Button>
    </div>
  )
}
