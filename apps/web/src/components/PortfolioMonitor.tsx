import { PortfolioCompany } from '@public-records/core'
import { Card } from '@public-records/ui/card'
import { Badge } from '@public-records/ui/badge'
import { HealthGradeBadge } from './HealthGradeBadge'
import { Alert, AlertDescription } from '@public-records/ui/alert'
import { WarningCircle, TrendUp, TrendDown } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { useState } from 'react'

interface PortfolioMonitorProps {
  companies: PortfolioCompany[]
}

const statusConfig = {
  performing: { label: 'Performing', color: 'bg-success text-success-foreground' },
  watch: { label: 'Watch List', color: 'bg-warning text-warning-foreground' },
  'at-risk': { label: 'At Risk', color: 'bg-destructive text-destructive-foreground' },
  default: { label: 'Default', color: 'bg-destructive text-destructive-foreground' }
}

const getNow = () => Date.now()

export function PortfolioMonitor({ companies }: PortfolioMonitorProps) {
  const atRiskCompanies = companies.filter(
    (c) => c.currentStatus === 'at-risk' || c.currentStatus === 'default'
  )
  const watchListCompanies = companies.filter((c) => c.currentStatus === 'watch')

  return (
    <div className="space-y-4 sm:space-y-6">
      {atRiskCompanies.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Alert variant="destructive" className="glass-effect border-destructive/50">
            <WarningCircle size={18} weight="fill" className="sm:w-5 sm:h-5" />
            <AlertDescription className="text-sm sm:text-base">
              <span className="font-semibold">{atRiskCompanies.length} portfolio companies</span>{' '}
              require immediate attention due to declining health scores.
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      <div className="space-y-4 sm:space-y-6">
        <div>
          <h3 className="font-semibold text-base sm:text-lg mb-3 text-white">At-Risk Companies</h3>
          {atRiskCompanies.length === 0 ? (
            <Card className="glass-effect p-4 sm:p-6">
              <p className="text-xs sm:text-sm text-white/70 text-center">
                No companies currently at risk
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {atRiskCompanies.map((company) => (
                <CompanyCard key={company.id} company={company} />
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-semibold text-base sm:text-lg mb-3 text-white">Watch List</h3>
          {watchListCompanies.length === 0 ? (
            <Card className="glass-effect p-4 sm:p-6">
              <p className="text-xs sm:text-sm text-white/70 text-center">
                No companies on watch list
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {watchListCompanies.map((company) => (
                <CompanyCard key={company.id} company={company} />
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-semibold text-base sm:text-lg mb-3 text-white">
            Performing Portfolio
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {companies
              .filter((c) => c.currentStatus === 'performing')
              .slice(0, 6)
              .map((company) => (
                <CompanyCard key={company.id} company={company} compact />
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function CompanyCard({
  company,
  compact = false
}: {
  company: PortfolioCompany
  compact?: boolean
}) {
  const [now] = useState(getNow)
  const statusConf = statusConfig[company.currentStatus]
  const daysSinceFunding = Math.floor(
    (now - new Date(company.fundingDate).getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <motion.div whileHover={{ scale: 1.01, y: -2 }} transition={{ duration: 0.2 }}>
      <Card
        className={`glass-effect ${compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5'} hover:shadow-lg transition-all duration-300`}
      >
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold mb-1 text-sm sm:text-base truncate">
              {company.companyName}
            </h4>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${statusConf.color} text-xs`}>{statusConf.label}</Badge>
              {company.lastAlertDate && (
                <Badge variant="outline" className="text-xs border-white/30">
                  Alert: {new Date(company.lastAlertDate).toLocaleDateString()}
                </Badge>
              )}
            </div>
          </div>
          <HealthGradeBadge grade={company.healthScore.grade} />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3 text-xs sm:text-sm">
          <div>
            <div className="text-white/70 text-xs mb-1">Funding Amount</div>
            <div className="font-mono font-semibold">
              ${(company.fundingAmount / 1000).toFixed(0)}K
            </div>
          </div>
          <div>
            <div className="text-white/70 text-xs mb-1">Days Since Funding</div>
            <div className="font-mono font-semibold">{daysSinceFunding}</div>
          </div>
        </div>

        {!compact && (
          <>
            <div className="flex items-center justify-between text-xs sm:text-sm pt-3 border-t border-white/20">
              <span className="text-white/70">Sentiment Trend</span>
              <div className="flex items-center gap-1">
                {company.healthScore.sentimentTrend === 'improving' ? (
                  <>
                    <TrendUp size={12} weight="bold" className="text-success sm:w-3.5 sm:h-3.5" />
                    <span className="text-success text-xs">Improving</span>
                  </>
                ) : company.healthScore.sentimentTrend === 'declining' ? (
                  <>
                    <TrendDown
                      size={12}
                      weight="bold"
                      className="text-destructive sm:w-3.5 sm:h-3.5"
                    />
                    <span className="text-destructive text-xs">Declining</span>
                  </>
                ) : (
                  <span className="text-white/70 text-xs">Stable</span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs sm:text-sm pt-2">
              <span className="text-white/70">Health Score</span>
              <span className="font-mono font-semibold">{company.healthScore.score}/100</span>
            </div>
          </>
        )}
      </Card>
    </motion.div>
  )
}
