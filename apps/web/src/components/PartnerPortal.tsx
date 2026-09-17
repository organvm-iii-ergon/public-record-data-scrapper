import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@public-records/ui/card'
import { Button } from '@public-records/ui/button'
import { Input } from '@public-records/ui/input'
import { Badge } from '@public-records/ui/badge'
import { Progress } from '@public-records/ui/progress'
import {
  Copy,
  CheckCircle,
  WarningCircle,
  ShareNetwork,
  Users,
  Handshake,
  CurrencyDollar,
  Percent,
  Trophy,
  ArrowsClockwise,
  EnvelopeSimple,
  Sparkle
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { PartnerMetrics, PartnerTier, ReferralEventType } from '@public-records/core'
import { fetchPartnerPortal, updatePartnerCode, updatePayoutEmail } from '@/lib/api/partner'

const TIER_COLORS: Record<PartnerTier, { bg: string; border: string; text: string }> = {
  bronze: {
    bg: 'bg-amber-900/20',
    border: 'border-amber-600/40',
    text: 'text-amber-400'
  },
  silver: {
    bg: 'bg-slate-400/20',
    border: 'border-slate-300/40',
    text: 'text-slate-200'
  },
  gold: {
    bg: 'bg-yellow-500/20',
    border: 'border-yellow-400/40',
    text: 'text-yellow-300'
  },
  platinum: {
    bg: 'bg-purple-500/20',
    border: 'border-purple-400/40',
    text: 'text-purple-300'
  }
}

const TIER_NAMES: Record<PartnerTier, string> = {
  bronze: 'Bronze Partner (15%)',
  silver: 'Silver Partner (20%)',
  gold: 'Gold Partner (25%)',
  platinum: 'Platinum Partner (30%)'
}

const EVENT_BADGES: Record<ReferralEventType, { label: string; className: string }> = {
  click: { label: 'Click', className: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  signup: {
    label: 'Signup',
    className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  },
  conversion: {
    label: 'Conversion',
    className: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
  },
  payout: { label: 'Payout', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' }
}

export interface PartnerPortalProps {
  initialMetrics?: PartnerMetrics
}

export function PartnerPortal({ initialMetrics }: PartnerPortalProps) {
  const [metrics, setMetrics] = useState<PartnerMetrics | null>(initialMetrics ?? null)
  const [loading, setLoading] = useState(!initialMetrics)
  const [error, setError] = useState<string | null>(null)

  // Custom Code Editor State
  const [customCode, setCustomCode] = useState('')
  const [savingCode, setSavingCode] = useState(false)
  const [codeSuccess, setCodeSuccess] = useState(false)

  // Payout Email Editor State
  const [payoutEmail, setPayoutEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState(false)

  const [copied, setCopied] = useState(false)

  const loadPortalData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPartnerPortal()
      setMetrics(data)
      setCustomCode(data.program.partnerCode)
      setPayoutEmail(data.program.payoutEmail || '')
    } catch (err) {
      setMetrics(null)
      setError(err instanceof Error ? err.message : 'Failed to load partner program data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialMetrics) {
      loadPortalData()
    } else {
      setMetrics(initialMetrics)
      setCustomCode(initialMetrics.program.partnerCode)
      setPayoutEmail(initialMetrics.program.payoutEmail || '')
    }
  }, [initialMetrics, loadPortalData])

  const handleCopyLink = async () => {
    if (!metrics?.program.referralUrl) return
    try {
      await navigator.clipboard.writeText(metrics.program.referralUrl)
      setCopied(true)
      toast.success('Referral link copied to clipboard!')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Failed to copy link')
    }
  }

  const handleSaveCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customCode.trim() || customCode.trim().length < 3) {
      toast.error('Partner code must be at least 3 characters long')
      return
    }

    setSavingCode(true)
    setCodeSuccess(false)
    try {
      const res = await updatePartnerCode(customCode.trim().toUpperCase())
      if (metrics) {
        setMetrics({
          ...metrics,
          program: res.program
        })
      }
      setCodeSuccess(true)
      toast.success(`Referral code updated to ${res.program.partnerCode}`)
      setTimeout(() => setCodeSuccess(false), 3000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update partner code')
    } finally {
      setSavingCode(false)
    }
  }

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payoutEmail.trim() || !payoutEmail.includes('@')) {
      toast.error('Valid payout email required')
      return
    }

    setSavingEmail(true)
    setEmailSuccess(false)
    try {
      const res = await updatePayoutEmail(payoutEmail.trim().toLowerCase())
      if (metrics) {
        setMetrics({
          ...metrics,
          program: res.program
        })
      }
      setEmailSuccess(true)
      toast.success('Payout destination email updated')
      setTimeout(() => setEmailSuccess(false), 3000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update payout email')
    } finally {
      setSavingEmail(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <ArrowsClockwise size={32} className="animate-spin text-primary" />
        <p className="text-sm text-white/70">Loading partner program and conversion metrics...</p>
      </div>
    )
  }

  if (error && !metrics) {
    return (
      <div className="p-8 text-center space-y-4">
        <WarningCircle size={40} className="mx-auto text-rose-400" />
        <h3 className="text-lg font-semibold text-white">Unable to Load Partner Portal</h3>
        <p className="text-sm text-white/60 max-w-md mx-auto">{error}</p>
        <Button onClick={loadPortalData} variant="outline" size="sm" className="mt-2">
          <ArrowsClockwise size={16} className="mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  const currentTier = metrics?.partnerTier || 'bronze'
  const tierStyle = TIER_COLORS[currentTier]
  const nextTierProgress =
    metrics?.nextTierThreshold && metrics.nextTierThreshold !== Infinity
      ? Math.min(
          100,
          Math.round(
            ((metrics.nextTierThreshold - metrics.conversionsToNextTier) /
              metrics.nextTierThreshold) *
              100
          )
        )
      : 100

  return (
    <div className="space-y-6 text-white">
      {/* Top Banner & Tier Badge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl glass-effect border border-white/10 bg-slate-900/40">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/20 text-primary border border-primary/30">
            <ShareNetwork size={24} weight="duotone" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">Referral & Partner Program</h3>
              <Badge
                variant="outline"
                className={`text-xs uppercase font-semibold ${tierStyle.bg} ${tierStyle.border} ${tierStyle.text}`}
              >
                <Trophy size={12} className="mr-1 inline" weight="fill" />
                {currentTier} Tier
              </Badge>
            </div>
            <p className="text-xs text-white/70">
              Earn {metrics?.commissionRate ?? 15}% recurring commission on referred subscribers
            </p>
          </div>
        </div>

        {/* Tier Progress */}
        <div className="w-full sm:w-64 bg-black/30 p-3 rounded-lg border border-white/10">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-white/60">Tier Milestone</span>
            <span className="font-semibold text-white">
              {metrics?.conversionsToNextTier === 0
                ? 'Top Tier'
                : `${metrics?.conversionsToNextTier} conversions to next tier`}
            </span>
          </div>
          <Progress value={nextTierProgress} className="h-1.5" />
          <p className="text-[11px] text-white/50 mt-1 truncate">
            Current: {TIER_NAMES[currentTier]}
          </p>
        </div>
      </div>

      {/* Referral Link & Code Customization */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Active Link Box */}
        <Card className="glass-effect border-white/10 bg-slate-900/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
              <Sparkle size={16} className="text-primary" />
              Your Unique Referral Link
            </CardTitle>
            <CardDescription className="text-xs text-white/60">
              Share this link with prospects, clients, or syndication partners.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={metrics?.program.referralUrl || ''}
                className="font-mono text-xs bg-black/40 border-white/20 text-white"
                aria-label="Your Referral URL"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="shrink-0 bg-primary/20 hover:bg-primary/30 border-primary/40 text-primary-foreground"
              >
                {copied ? (
                  <>
                    <CheckCircle size={14} className="mr-1 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={14} className="mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <p className="text-[11px] text-white/50">
              Cookies persist for 60 days. Conversions automatically attribute to your account.
            </p>
          </CardContent>
        </Card>

        {/* Custom Code Editor */}
        <Card className="glass-effect border-white/10 bg-slate-900/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
              <ShareNetwork size={16} className="text-primary" />
              Custom Referral Code
            </CardTitle>
            <CardDescription className="text-xs text-white/60">
              Personalize your tracking code (e.g. VIP-GROWTH, ACME-PARTNER).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveCode} className="flex gap-2">
              <Input
                value={customCode}
                onChange={(e) =>
                  setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))
                }
                placeholder="CUSTOM-CODE"
                maxLength={30}
                className="font-mono text-xs uppercase bg-black/40 border-white/20 text-white"
                aria-label="Custom Partner Code"
              />
              <Button
                type="submit"
                disabled={savingCode || !customCode.trim()}
                size="sm"
                variant="outline"
                className="shrink-0 border-white/20 hover:bg-white/10"
              >
                {savingCode ? (
                  <ArrowsClockwise size={14} className="animate-spin" />
                ) : codeSuccess ? (
                  <CheckCircle size={14} className="text-emerald-400" />
                ) : (
                  'Update'
                )}
              </Button>
            </form>
            <p className="text-[11px] text-white/50 mt-2">
              Uppercase letters, digits, hyphens, and underscores (3-30 chars).
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Funnel Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="glass-effect border-white/10 bg-slate-900/40 p-3 text-center">
          <span className="text-[11px] text-white/60 uppercase font-medium flex items-center justify-center gap-1">
            <ShareNetwork size={12} className="text-blue-400" />
            Clicks
          </span>
          <div className="text-xl font-bold text-white mt-1">{metrics?.totalClicks ?? 0}</div>
          <span className="text-[10px] text-white/40">Total visits</span>
        </Card>

        <Card className="glass-effect border-white/10 bg-slate-900/40 p-3 text-center">
          <span className="text-[11px] text-white/60 uppercase font-medium flex items-center justify-center gap-1">
            <Users size={12} className="text-emerald-400" />
            Signups
          </span>
          <div className="text-xl font-bold text-white mt-1">{metrics?.totalSignups ?? 0}</div>
          <span className="text-[10px] text-white/40">Free trials & leads</span>
        </Card>

        <Card className="glass-effect border-white/10 bg-slate-900/40 p-3 text-center">
          <span className="text-[11px] text-white/60 uppercase font-medium flex items-center justify-center gap-1">
            <Handshake size={12} className="text-purple-400" />
            Conversions
          </span>
          <div className="text-xl font-bold text-white mt-1">{metrics?.totalConversions ?? 0}</div>
          <span className="text-[10px] text-white/40">Paid subscribers</span>
        </Card>

        <Card className="glass-effect border-white/10 bg-slate-900/40 p-3 text-center">
          <span className="text-[11px] text-white/60 uppercase font-medium flex items-center justify-center gap-1">
            <Percent size={12} className="text-yellow-400" />
            Conv. Rate
          </span>
          <div className="text-xl font-bold text-white mt-1">{metrics?.conversionRate ?? 0}%</div>
          <span className="text-[10px] text-white/40">Paid / Visits</span>
        </Card>

        <Card className="glass-effect border-white/10 bg-slate-900/40 p-3 text-center">
          <span className="text-[11px] text-white/60 uppercase font-medium flex items-center justify-center gap-1">
            <CurrencyDollar size={12} className="text-emerald-400" />
            Total Earned
          </span>
          <div className="text-xl font-bold text-emerald-400 mt-1">
            $
            {(metrics?.totalEarningsUsd ?? 0).toLocaleString(undefined, {
              minimumFractionDigits: 2
            })}
          </div>
          <span className="text-[10px] text-white/40">Cumulative</span>
        </Card>

        <Card className="glass-effect border-white/10 bg-slate-900/40 p-3 text-center">
          <span className="text-[11px] text-white/60 uppercase font-medium flex items-center justify-center gap-1">
            <CurrencyDollar size={12} className="text-amber-400" />
            Pending Payout
          </span>
          <div className="text-xl font-bold text-amber-300 mt-1">
            $
            {(metrics?.pendingEarningsUsd ?? 0).toLocaleString(undefined, {
              minimumFractionDigits: 2
            })}
          </div>
          <span className="text-[10px] text-white/40">Net balance</span>
        </Card>
      </div>

      {/* Payout Destination Email */}
      <Card className="glass-effect border-white/10 bg-slate-900/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
            <EnvelopeSimple size={16} className="text-primary" />
            Affiliate Payout Email
          </CardTitle>
          <CardDescription className="text-xs text-white/60">
            Designate the PayPal or ACH email address where affiliate commission disbursements
            should be sent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveEmail} className="flex gap-2 max-w-md">
            <Input
              type="email"
              value={payoutEmail}
              onChange={(e) => setPayoutEmail(e.target.value)}
              placeholder="payouts@yourfirm.com"
              className="text-xs bg-black/40 border-white/20 text-white"
              aria-label="Affiliate Payout Email"
            />
            <Button
              type="submit"
              disabled={savingEmail || !payoutEmail.trim()}
              size="sm"
              variant="outline"
              className="shrink-0 border-white/20 hover:bg-white/10"
            >
              {savingEmail ? (
                <ArrowsClockwise size={14} className="animate-spin" />
              ) : emailSuccess ? (
                <CheckCircle size={14} className="text-emerald-400" />
              ) : (
                'Save Email'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Recent Referral Activity Table */}
      <Card className="glass-effect border-white/10 bg-slate-900/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between text-white">
            <span>Recent Referral Activity</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadPortalData}
              className="text-xs text-white/60 hover:text-white hover:bg-white/10 h-7 px-2"
            >
              <ArrowsClockwise size={12} className="mr-1" />
              Refresh
            </Button>
          </CardTitle>
          <CardDescription className="text-xs text-white/60">
            Real-time feed of clicks, registrations, paid upgrades, and payouts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics?.recentEvents && metrics.recentEvents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-white/60 uppercase tracking-wider text-[10px]">
                    <th className="py-2 px-3">Event</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Referred Client</th>
                    <th className="py-2 px-3 text-right">Revenue</th>
                    <th className="py-2 px-3 text-right">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-sans">
                  {metrics.recentEvents.map((evt) => {
                    const badge = EVENT_BADGES[evt.eventType] || {
                      label: evt.eventType,
                      className: 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                    }
                    return (
                      <tr key={evt.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-white/70 whitespace-nowrap">
                          {new Date(evt.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-white/80">
                          {evt.referredEmail ||
                            (evt.metadata?.referrer
                              ? String(evt.metadata.referrer)
                              : evt.referredOrgId
                                ? `Org ${evt.referredOrgId.slice(0, 8)}`
                                : 'Direct Link Visit')}
                        </td>
                        <td className="py-2.5 px-3 text-right text-white/70">
                          {evt.revenueAmount > 0 ? `$${evt.revenueAmount.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-emerald-400">
                          {evt.commissionAmount > 0 ? `+$${evt.commissionAmount.toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-white/50 text-xs">
              No referral activity recorded yet. Share your link to start tracking clicks!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
export default PartnerPortal
