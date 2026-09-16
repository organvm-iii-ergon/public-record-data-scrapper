import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@public-records/ui/dialog'
import { ShareNetwork } from '@phosphor-icons/react'
import { PartnerPortal } from './PartnerPortal'

interface PartnerPortalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PartnerPortalDialog({ open, onOpenChange }: PartnerPortalDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl glass-effect border-white/20 bg-slate-950/95 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShareNetwork size={24} weight="fill" className="text-primary" />
            <DialogTitle className="text-xl font-bold text-white">
              Referral & Partner Portal
            </DialogTitle>
          </div>
          <DialogDescription className="text-white/70">
            Generate custom referral links, monitor inbound traffic, and track affiliate commission
            conversions.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <PartnerPortal />
        </div>
      </DialogContent>
    </Dialog>
  )
}
export default PartnerPortalDialog
