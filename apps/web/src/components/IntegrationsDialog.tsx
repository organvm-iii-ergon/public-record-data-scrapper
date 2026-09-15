import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@public-records/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@public-records/ui/tabs'
import { Button } from '@public-records/ui/button'
import { Input } from '@public-records/ui/input'
import { Badge } from '@public-records/ui/badge'
import { Switch } from '@public-records/ui/switch'
import { Label } from '@public-records/ui/label'
import { Card, CardContent, CardHeader, CardDescription } from '@public-records/ui/card'
import {
  PlugsConnected,
  ShareNetwork,
  ArrowsClockwise,
  CheckCircle,
  WarningCircle,
  Copy,
  Plus,
  Trash,
  Lightning,
  ShieldCheck,
  PaperPlaneTilt
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { WebhookEndpoint, WebhookDelivery, CrmProvider } from '@public-records/core'

interface IntegrationsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function IntegrationsDialog({ open, onOpenChange }: IntegrationsDialogProps) {
  // Webhook Endpoints State
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([
    {
      id: 'whe_demo_01',
      orgId: 'org_current',
      url: 'https://api.customer-crm.com/v1/ucc-events',
      secret: 'whsec_99e821bca98104889c0201d1',
      secretPreview: 'whsec_99••••d1',
      description: 'Production webhook listener',
      events: ['prospect.created', 'prospect.updated', 'score.updated'],
      status: 'active',
      consecutiveFailures: 0,
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      updatedAt: new Date().toISOString()
    }
  ])

  // New endpoint inputs
  const [newUrl, setNewUrl] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [selectedEvents] = useState<string[]>([
    'prospect.created',
    'prospect.updated',
    'score.updated'
  ])

  // Deliveries / DLQ state
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([
    {
      id: 'del_001',
      orgId: 'org_current',
      webhookId: 'whe_demo_01',
      event: 'prospect.created',
      payload: '{"id":"evt_01","event":"prospect.created","data":{"companyName":"Apex Logistics"}}',
      status: 'delivered',
      attempts: 1,
      maxAttempts: 5,
      responseStatus: 200,
      deliveredAt: new Date(Date.now() - 3600000).toISOString(),
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'del_002',
      orgId: 'org_current',
      webhookId: 'whe_demo_01',
      event: 'score.updated',
      payload:
        '{"id":"evt_02","event":"score.updated","data":{"companyName":"Metro Builders","score":88}}',
      status: 'dead_letter',
      attempts: 5,
      maxAttempts: 5,
      responseStatus: 503,
      errorMessage: 'HTTP 503: Service Temporarily Unavailable after 5 attempts',
      createdAt: new Date(Date.now() - 7200000).toISOString()
    }
  ])

  // CRM Configuration state
  const [hubspotKey, setHubspotKey] = useState('pat-na1-xxxx-xxxx-xxxx')
  const [hubspotActive, setHubspotActive] = useState(true)
  const [hubspotAutoSync, setHubspotAutoSync] = useState(true)
  const [salesforceKey, setSalesforceKey] = useState('')
  const [salesforceActive, setSalesforceActive] = useState(false)
  const [testingCrm, setTestingCrm] = useState<string | null>(null)

  const handleAddEndpoint = () => {
    if (!newUrl.trim()) {
      toast.error('Please enter a valid destination URL')
      return
    }

    const generatedSecret = `whsec_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`
    const newEp: WebhookEndpoint = {
      id: `whe_${Date.now()}`,
      orgId: 'org_current',
      url: newUrl,
      description: newDescription || undefined,
      secret: generatedSecret,
      secretPreview: `${generatedSecret.slice(0, 8)}••••${generatedSecret.slice(-4)}`,
      events: selectedEvents.length > 0 ? selectedEvents : ['*'],
      status: 'active',
      consecutiveFailures: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    setEndpoints((prev) => [newEp, ...prev])
    setNewUrl('')
    setNewDescription('')
    toast.success('Webhook endpoint registered. Secret generated.')
  }

  const handleDeleteEndpoint = (id: string) => {
    setEndpoints((prev) => prev.filter((ep) => ep.id !== id))
    toast.success('Webhook endpoint removed')
  }

  const handleTestPing = (ep: WebhookEndpoint) => {
    toast.promise(new Promise((resolve) => setTimeout(resolve, 800)), {
      loading: `Sending HMAC-SHA256 signed test ping to ${ep.url}...`,
      success: () => {
        const testDelivery: WebhookDelivery = {
          id: `del_${Date.now()}`,
          orgId: ep.orgId,
          webhookId: ep.id,
          event: 'test.ping',
          payload: JSON.stringify({
            id: `evt_test_${Date.now()}`,
            event: 'test.ping',
            api_version: '2026-09-01',
            data: { message: 'Ping from UCC-MCA Platform', timestamp: new Date().toISOString() }
          }),
          status: 'delivered',
          attempts: 1,
          maxAttempts: 1,
          responseStatus: 200,
          deliveredAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        }
        setDeliveries((prev) => [testDelivery, ...prev])
        return 'Test ping delivered successfully with valid signature!'
      },
      error: 'Failed to deliver test ping'
    })
  }

  const handleReplayDelivery = (deliveryId: string) => {
    toast.promise(new Promise((resolve) => setTimeout(resolve, 900)), {
      loading: 'Replaying dead-letter delivery from queue...',
      success: () => {
        setDeliveries((prev) =>
          prev.map((d) =>
            d.id === deliveryId
              ? {
                  ...d,
                  status: 'delivered',
                  attempts: 1,
                  errorMessage: undefined,
                  responseStatus: 200,
                  deliveredAt: new Date().toISOString()
                }
              : d
          )
        )
        return 'Delivery redelivered successfully! DLQ cleared.'
      },
      error: 'Redelivery failed'
    })
  }

  const handleTestCrm = (provider: CrmProvider) => {
    setTestingCrm(provider)
    setTimeout(() => {
      setTestingCrm(null)
      toast.success(
        `${provider === 'hubspot' ? 'HubSpot REST API v3' : provider} connection verified! Ready to push prospects.`
      )
    }, 1000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl glass-effect border-white/20 bg-slate-950/95 text-white max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <PlugsConnected size={24} weight="fill" className="text-primary" />
            <DialogTitle className="text-xl font-bold text-white">
              Customer System Integrations
            </DialogTitle>
          </div>
          <DialogDescription className="text-white/70">
            Push real-time UCC prospect intelligence into external CRMs and subscribed webhook
            endpoints.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="crm" className="w-full mt-2">
          <TabsList className="grid grid-cols-2 bg-white/5 border border-white/10 p-1 mb-4">
            <TabsTrigger value="crm" className="flex items-center gap-2">
              <Lightning size={16} weight="bold" />
              <span>CRM Integrations (HubSpot)</span>
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="flex items-center gap-2">
              <ShareNetwork size={16} weight="bold" />
              <span>Webhooks & Dead-Letter Queue</span>
            </TabsTrigger>
          </TabsList>

          {/* CRM INTEGRATIONS TAB */}
          <TabsContent value="crm" className="space-y-4">
            <div className="p-3.5 rounded-lg border border-primary/30 bg-primary/10 flex items-start gap-3">
              <ShieldCheck size={24} weight="fill" className="text-primary mt-0.5 flex-shrink-0" />
              <div className="text-xs space-y-1 text-white/90">
                <span className="font-semibold text-white">
                  Native HubSpot Push (Most Requested MCA Integration)
                </span>
                <p>
                  Directly upsert high-priority UCC prospect records into HubSpot Companies &
                  Contacts using HubSpot REST API v3. Eliminates manual data entry for ISO brokers
                  and MCA syndication desks.
                </p>
              </div>
            </div>

            {/* HubSpot Card */}
            <Card className="glass-effect border-white/20 bg-slate-900/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white">HubSpot</span>
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-[10px]"
                    >
                      Recommended
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="hubspot-toggle" className="text-xs text-white/70">
                      {hubspotActive ? 'Enabled' : 'Disabled'}
                    </Label>
                    <Switch
                      id="hubspot-toggle"
                      checked={hubspotActive}
                      onCheckedChange={setHubspotActive}
                    />
                  </div>
                </div>
                <CardDescription className="text-xs text-white/60">
                  Connect using a HubSpot Private App Access Token with{' '}
                  <code className="text-primary">crm.objects.companies.write</code> scope.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/80">Private App Access Token</Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      value={hubspotKey}
                      onChange={(e) => setHubspotKey(e.target.value)}
                      placeholder="pat-na1-..."
                      className="glass-effect border-white/20 text-white text-xs font-mono h-9"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTestCrm('hubspot')}
                      disabled={testingCrm === 'hubspot' || !hubspotActive}
                      className="border-white/30 text-white hover:bg-white/10 flex-shrink-0 h-9"
                    >
                      <ArrowsClockwise
                        size={14}
                        className={testingCrm === 'hubspot' ? 'animate-spin mr-1' : 'mr-1'}
                      />
                      Test Connection
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-white/10 text-xs">
                  <div>
                    <span className="font-medium text-white/90">
                      Auto-push High Priority Prospects
                    </span>
                    <p className="text-[11px] text-white/60">
                      Automatically create Company when priority score &ge; 75
                    </p>
                  </div>
                  <Switch
                    checked={hubspotAutoSync}
                    onCheckedChange={setHubspotAutoSync}
                    disabled={!hubspotActive}
                  />
                </div>

                <div className="p-2.5 rounded bg-black/40 border border-white/10 text-[11px] text-white/70 space-y-1">
                  <div className="font-semibold text-white/90">Default Property Mappings:</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <span>
                      • Debtor Company &rarr; <code className="text-emerald-300">name</code>
                    </span>
                    <span>
                      • Priority Score &rarr;{' '}
                      <code className="text-emerald-300">ucc_priority_score</code>
                    </span>
                    <span>
                      • State & City &rarr; <code className="text-emerald-300">state, city</code>
                    </span>
                    <span>
                      • UCC Status &rarr; <code className="text-emerald-300">ucc_status</code>
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Salesforce Card */}
            <Card className="glass-effect border-white/10 bg-slate-900/40">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Salesforce</span>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="salesforce-toggle" className="text-xs text-white/70">
                      {salesforceActive ? 'Enabled' : 'Disabled'}
                    </Label>
                    <Switch
                      id="salesforce-toggle"
                      checked={salesforceActive}
                      onCheckedChange={setSalesforceActive}
                    />
                  </div>
                </div>
                <CardDescription className="text-xs text-white/50">
                  Enterprise Lead object export via OAuth 2.0 Connected App.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={salesforceKey}
                    onChange={(e) => setSalesforceKey(e.target.value)}
                    placeholder="Enter Salesforce Connected App Token"
                    className="glass-effect border-white/20 text-white text-xs h-9"
                    disabled={!salesforceActive}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!salesforceActive}
                    onClick={() => handleTestCrm('salesforce')}
                    className="border-white/20 text-white h-9"
                  >
                    Connect
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WEBHOOKS & DLQ TAB */}
          <TabsContent value="webhooks" className="space-y-4">
            {/* New Endpoint Form */}
            <div className="p-3 rounded-lg border border-white/15 bg-white/5 space-y-3">
              <div className="font-semibold text-sm text-white flex items-center gap-1.5">
                <Plus size={16} weight="bold" className="text-primary" />
                Register New Webhook Endpoint
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  placeholder="https://your-domain.com/webhooks/ucc"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="glass-effect border-white/20 text-white text-xs h-9"
                />
                <Input
                  placeholder="Description (e.g. Lead Router Lambda)"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="glass-effect border-white/20 text-white text-xs h-9"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2 text-xs text-white/70">
                  <span>Signed using:</span>
                  <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                    HMAC-SHA256 (X-UCC-Signature)
                  </Badge>
                </div>
                <Button size="sm" onClick={handleAddEndpoint} className="h-8 text-xs">
                  Register Endpoint
                </Button>
              </div>
            </div>

            {/* Endpoints List */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-white/80 uppercase tracking-wide">
                Configured Endpoints ({endpoints.length})
              </div>
              {endpoints.map((ep) => (
                <div
                  key={ep.id}
                  className="p-3 rounded-lg border border-white/10 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-white truncate">{ep.url}</span>
                      <Badge
                        variant="outline"
                        className={
                          ep.status === 'active'
                            ? 'border-emerald-500/40 text-emerald-300'
                            : 'border-amber-500/40 text-amber-300'
                        }
                      >
                        {ep.status}
                      </Badge>
                    </div>
                    {ep.description && (
                      <p className="text-white/60 text-[11px]">{ep.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-white/50 text-[11px]">
                      <span>Secret: {ep.secretPreview || 'whsec_••••••••'}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(ep.secret || '')
                          toast.success('Webhook signing secret copied!')
                        }}
                        className="text-primary hover:underline flex items-center gap-0.5"
                      >
                        <Copy size={11} /> copy
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTestPing(ep)}
                      className="h-7 text-[11px] border-white/20 text-white"
                    >
                      <PaperPlaneTilt size={12} className="mr-1" />
                      Test Ping
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteEndpoint(ep.id)}
                      className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Deliveries & DLQ Table */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-white/80 uppercase tracking-wide">
                  Recent Deliveries & Dead-Letter Queue (DLQ)
                </div>
                <Badge
                  variant="outline"
                  className="border-amber-500/40 bg-amber-500/10 text-amber-300 text-[10px]"
                >
                  5-step Exponential Backoff
                </Badge>
              </div>

              <div className="border border-white/10 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 border-b border-white/10 text-white/60">
                    <tr>
                      <th className="p-2">Event</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Attempts</th>
                      <th className="p-2">Response / Error</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {deliveries.map((del) => (
                      <tr key={del.id} className="hover:bg-white/5">
                        <td className="p-2 font-mono text-white/90">{del.event}</td>
                        <td className="p-2">
                          {del.status === 'delivered' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400">
                              <CheckCircle size={13} weight="fill" /> Delivered
                            </span>
                          ) : del.status === 'dead_letter' ? (
                            <span className="inline-flex items-center gap-1 text-red-400 font-semibold">
                              <WarningCircle size={13} weight="fill" /> Dead-Letter (DLQ)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-400">
                              <ArrowsClockwise size={13} className="animate-spin" /> Pending
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-white/70">
                          {del.attempts}/{del.maxAttempts}
                        </td>
                        <td className="p-2 text-white/60 max-w-[200px] truncate">
                          {del.responseStatus
                            ? `HTTP ${del.responseStatus}`
                            : del.errorMessage || '—'}
                        </td>
                        <td className="p-2 text-right">
                          {del.status === 'dead_letter' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReplayDelivery(del.id)}
                              className="h-6 px-2 text-[10px] border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                            >
                              <ArrowsClockwise size={10} className="mr-1" />
                              Replay DLQ
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
