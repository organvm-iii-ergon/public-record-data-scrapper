import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ProspectCard } from '@/components/ProspectCard'
import { AdvancedFilters, AdvancedFilterState } from '@/components/AdvancedFilters'
import { BatchOperations } from '@/components/BatchOperations'
import { SortControls, SortField, SortDirection } from '@/components/SortControls'
import { Prospect, IndustryType } from '@/lib/types'
import { ExportFormat } from '@/lib/exportUtils'
import { MagnifyingGlass } from '@phosphor-icons/react'

interface ProspectsTabProps {
  // Data
  prospects: Prospect[]
  filteredProspects: Prospect[]
  totalCount: number
  // Filters
  searchQuery: string
  industryFilter: string
  stateFilter: string
  minScore: number
  advancedFilters: AdvancedFilterState
  activeFilterCount: number
  industries: IndustryType[]
  states: string[]
  // Sort
  sortField: SortField
  sortDirection: SortDirection
  // Selection
  selectedIds: Set<string>
  // Export
  exportFormat: ExportFormat
  // Callbacks
  onSearchChange: (query: string) => void
  onIndustryChange: (industry: string) => void
  onStateChange: (state: string) => void
  onMinScoreChange: (score: number) => void
  onAdvancedFiltersChange: (filters: AdvancedFilterState) => void
  onSortChange: (field: SortField, direction: SortDirection) => void
  onSelectionChange: (ids: Set<string>) => void
  onExportFormatChange: (format: ExportFormat) => void
  onProspectSelect: (prospect: Prospect) => void
  onBatchClaim: (ids: string[]) => void
  onBatchExport: (ids: string[]) => void
  onBatchDelete: (ids: string[]) => void
}

export function ProspectsTab({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  prospects: _prospects,
  filteredProspects,
  totalCount,
  searchQuery,
  industryFilter,
  stateFilter,
  minScore,
  advancedFilters,
  activeFilterCount,
  industries,
  states,
  sortField,
  sortDirection,
  selectedIds,
  exportFormat,
  onSearchChange,
  onIndustryChange,
  onStateChange,
  onMinScoreChange,
  onAdvancedFiltersChange,
  onSortChange,
  onSelectionChange,
  onExportFormatChange,
  onProspectSelect,
  onBatchClaim,
  onBatchExport,
  onBatchDelete
}: ProspectsTabProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Search and Filter Controls */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="relative flex-1">
          <MagnifyingGlass
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70"
          />
          <Input
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 glass-effect border-white/30 text-white placeholder:text-white/50 h-10 sm:h-11"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={industryFilter} onValueChange={onIndustryChange}>
            <SelectTrigger className="flex-1 min-w-[140px] sm:w-[180px] glass-effect border-white/30 text-white h-10 sm:h-11">
              <SelectValue placeholder="Industry" />
            </SelectTrigger>
            <SelectContent className="glass-effect border-white/30">
              <SelectItem value="all">All Industries</SelectItem>
              {industries.map((ind) => (
                <SelectItem key={ind} value={ind} className="capitalize">
                  {ind}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stateFilter} onValueChange={onStateChange}>
            <SelectTrigger className="flex-1 min-w-[100px] sm:w-[140px] glass-effect border-white/30 text-white h-10 sm:h-11">
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent className="glass-effect border-white/30">
              <SelectItem value="all">All States</SelectItem>
              {states.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={minScore.toString()}
            onValueChange={(val) => onMinScoreChange(Number(val))}
          >
            <SelectTrigger className="flex-1 min-w-[120px] sm:w-[140px] glass-effect border-white/30 text-white h-10 sm:h-11">
              <SelectValue placeholder="Min Score" />
            </SelectTrigger>
            <SelectContent className="glass-effect border-white/30">
              <SelectItem value="0">Any Score</SelectItem>
              <SelectItem value="50">50+</SelectItem>
              <SelectItem value="70">70+ (High)</SelectItem>
              <SelectItem value="85">85+ (Elite)</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={exportFormat}
            onValueChange={(val) => onExportFormatChange(val as ExportFormat)}
          >
            <SelectTrigger className="flex-1 min-w-[110px] sm:w-[130px] glass-effect border-white/30 text-white h-10 sm:h-11">
              <SelectValue placeholder="Export Format" />
            </SelectTrigger>
            <SelectContent className="glass-effect border-white/30">
              <SelectItem value="json">Export: JSON</SelectItem>
              <SelectItem value="csv">Export: CSV</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Header and Controls */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="text-xs sm:text-sm text-white/70">
              Showing {filteredProspects.length} of {totalCount} prospects
            </div>
            <SortControls
              sortField={sortField}
              sortDirection={sortDirection}
              onSortChange={onSortChange}
            />
          </div>
          <AdvancedFilters
            filters={advancedFilters}
            onFiltersChange={onAdvancedFiltersChange}
            activeFilterCount={activeFilterCount}
          />
        </div>

        <BatchOperations
          prospects={filteredProspects}
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
          onBatchClaim={onBatchClaim}
          onBatchExport={onBatchExport}
          onBatchDelete={onBatchDelete}
        />

        {/* Prospect Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {filteredProspects.map((prospect) => {
            const isSelected = selectedIds.has(prospect.id)
            return (
              <div key={prospect.id} className="relative">
                <div className="absolute top-3 sm:top-4 left-3 sm:left-4 z-10">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      const newSelected = new Set(selectedIds)
                      if (checked) {
                        newSelected.add(prospect.id)
                      } else {
                        newSelected.delete(prospect.id)
                      }
                      onSelectionChange(newSelected)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="glass-effect border-white/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                </div>
                <ProspectCard prospect={prospect} onSelect={onProspectSelect} />
              </div>
            )
          })}
        </div>

        {/* Empty State */}
        {filteredProspects.length === 0 && (
          <div className="text-center py-12 text-white/70 glass-effect rounded-lg p-8">
            No prospects match your current filters
          </div>
        )}
      </div>
    </div>
  )
}
