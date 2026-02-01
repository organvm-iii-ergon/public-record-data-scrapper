import { EmailTemplate } from './types'

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'template-initial-1',
    name: 'Initial Outreach - High Priority',
    subject: 'Business Growth Opportunity for {{companyName}}',
    body: `Hi there,

I noticed that {{companyName}} has shown some impressive growth signals recently, including {{signalSummary}}. Your business health grade of {{healthGrade}} suggests you're in a strong position to capitalize on new opportunities.

With a {{recoveryLikelihood}}% recovery likelihood based on our predictive analytics, we believe there may be excellent financing options available to support your continued growth.

I'd love to schedule a brief call to discuss how we can help fuel your expansion plans.

Are you available for a 15-minute conversation this week?

Best regards,
{{senderName}}`,
    category: 'initial-outreach',
    variables: ['companyName', 'signalSummary', 'healthGrade', 'recoveryLikelihood', 'senderName']
  },
  {
    id: 'template-followup-1',
    name: 'Follow-up - No Response',
    subject: 'Following up: Financing for {{companyName}}',
    body: `Hi,

I wanted to follow up on my previous email about potential financing opportunities for {{companyName}}.

I understand you're busy running your {{industryType}} business, so I'll keep this brief. Our analysis shows:

• Priority Score: {{priorityScore}}/100
• Recovery Likelihood: {{recoveryLikelihood}}%
• Active Growth Signals: {{signalCount}}

These indicators suggest you're in an excellent position to secure favorable financing terms.

Would a quick 10-minute call work for you? I'm happy to work around your schedule.

Best,
{{senderName}}`,
    category: 'follow-up',
    variables: [
      'companyName',
      'industryType',
      'priorityScore',
      'recoveryLikelihood',
      'signalCount',
      'senderName'
    ]
  },
  {
    id: 'template-recovery-1',
    name: 'Recovery Offer - Default History',
    subject: 'Second Chance Financing for {{companyName}}',
    body: `Hello,

I'm reaching out because {{companyName}} has shown remarkable resilience since your previous financing challenges {{yearsSinceDefault}} years ago.

Our ML-powered analysis indicates:
• Business Health: {{healthGrade}} grade
• Recent Growth Signals: {{signalCount}} positive indicators
• Recovery Confidence: {{mlConfidence}}%

Many businesses that have weathered financial difficulties are now stronger for it. We specialize in working with companies like yours that are ready for a fresh start.

We have financing programs specifically designed for businesses with your profile. Can we schedule a confidential discussion about your options?

Regards,
{{senderName}}`,
    category: 'recovery-offer',
    variables: [
      'companyName',
      'yearsSinceDefault',
      'healthGrade',
      'signalCount',
      'mlConfidence',
      'senderName'
    ]
  },
  {
    id: 'template-checkin-1',
    name: 'Check-in - Previous Discussion',
    subject: 'Checking in with {{companyName}}',
    body: `Hi,

I wanted to check in and see how things are going with {{companyName}}.

Since we last spoke, I've noticed {{newSignalSummary}}. This aligns well with the growth trajectory we discussed.

If the timing is better now, I'd be happy to revisit the financing options we outlined. Our terms remain competitive, and we can move quickly if you're ready.

Let me know if you'd like to reconnect.

Best wishes,
{{senderName}}`,
    category: 'check-in',
    variables: ['companyName', 'newSignalSummary', 'senderName']
  },
  {
    id: 'template-initial-2',
    name: 'Initial Outreach - Equipment Focus',
    subject: 'Equipment Financing Available for {{companyName}}',
    body: `Hello,

I came across {{companyName}} and noticed you're {{equipmentSignal}}.

As a {{industryType}} business with a {{healthGrade}} health rating, you may qualify for attractive equipment financing terms. Our analysis shows a {{recoveryLikelihood}}% likelihood of successful repayment.

Benefits of working with us:
• Fast approval (often within 24-48 hours)
• Competitive rates for strong businesses
• Flexible terms based on cash flow

Would you be interested in exploring your options? I can provide a quote with no obligation.

Thanks,
{{senderName}}`,
    category: 'initial-outreach',
    variables: [
      'companyName',
      'equipmentSignal',
      'industryType',
      'healthGrade',
      'recoveryLikelihood',
      'senderName'
    ]
  }
]

export function populateTemplate(
  template: EmailTemplate,
  data: Record<string, string | number>
): { subject: string; body: string } {
  let subject = template.subject
  let body = template.body

  // Replace all template variables
  template.variables.forEach((variable) => {
    const regex = new RegExp(`{{${variable}}}`, 'g')
    const value = String(data[variable] || `[${variable}]`)
    subject = subject.replace(regex, value)
    body = body.replace(regex, value)
  })

  return { subject, body }
}
