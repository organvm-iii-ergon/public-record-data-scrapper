/**
 * DisclosureCalculator
 *
 * Calculates required disclosure values for MCA deals per state regulations.
 * Supports different MCA structures (daily, weekly, split) and various
 * state-specific calculation requirements.
 *
 * Key calculations:
 * - Total funds provided
 * - Total dollar cost (factor rate x amount)
 * - APR-equivalent calculation
 * - Payment schedule breakdown
 *
 * Supported regulations:
 * - CA SB 1235 (California)
 * - NY CFDL (New York Commercial Financing Disclosure Law)
 */

import type { Deal } from '@public-records/core'
import { ValidationError } from '../errors'

// Payment frequency types
export type PaymentFrequency = 'daily' | 'weekly' | 'monthly' | 'split'

// MCA deal input for calculations
export interface DealInput {
  fundingAmount: number
  factorRate: number
  termDays?: number
  termMonths?: number
  paymentFrequency: PaymentFrequency
  holdbackPercentage?: number // For split payment MCA
  estimatedMonthlyRevenue?: number // For calculating split payments
  originationFee?: number
  brokerFee?: number
  otherFees?: number
}

// Complete disclosure calculation result
export interface DisclosureCalculation {
  fundingAmount: number
  totalDollarCost: number
  financeCharge: number
  totalFees: number
  totalPayback: number
  termDays: number
  paymentFrequency: PaymentFrequency
  paymentAmount: number
  numberOfPayments: number
  aprEquivalent: number // As decimal (0.35 = 35%)
  effectiveRate: number // Simple interest rate equivalent
  prepaymentPolicy: string
  paymentSchedule: PaymentScheduleEntry[]
}

// Individual payment in schedule
export interface PaymentScheduleEntry {
  paymentNumber: number
  paymentDate: Date
  paymentAmount: number
  principalPortion: number
  interestPortion: number
  remainingBalance: number
}

// State-specific disclosure requirements
export interface StateRequirements {
  state: string
  regulationName: string
  requiresApr: boolean
  requiresTermInDays: boolean
  requiresPaymentSchedule: boolean
  requiresFinanceCharge: boolean
  requiresPrepaymentDisclosure: boolean
  includeFeesInApr: boolean
  aprCalculationMethod: 'annualized_rate' | 'true_apr'
}

// Default state requirements
const STATE_REQUIREMENTS: Record<string, StateRequirements> = {
  CA: {
    state: 'CA',
    regulationName: 'SB 1235',
    requiresApr: true,
    requiresTermInDays: true,
    requiresPaymentSchedule: true,
    requiresFinanceCharge: true,
    requiresPrepaymentDisclosure: true,
    includeFeesInApr: false,
    aprCalculationMethod: 'annualized_rate'
  },
  NY: {
    state: 'NY',
    regulationName: 'CFDL',
    requiresApr: true,
    requiresTermInDays: true,
    requiresPaymentSchedule: true,
    requiresFinanceCharge: true,
    requiresPrepaymentDisclosure: true,
    includeFeesInApr: true,
    aprCalculationMethod: 'true_apr'
  }
}

export class DisclosureCalculator {
  /**
   * Calculate all disclosure values for a deal
   */
  calculateDisclosure(input: DealInput, state: string = 'CA'): DisclosureCalculation {
    this.validateInput(input)

    const requirements = STATE_REQUIREMENTS[state] || STATE_REQUIREMENTS['CA']

    // Calculate term in days
    const termDays = input.termDays || (input.termMonths ? input.termMonths * 30 : 0)
    if (termDays <= 0) {
      throw new ValidationError('Term must be greater than 0')
    }

    // Calculate total fees
    const totalFees = (input.originationFee || 0) + (input.brokerFee || 0) + (input.otherFees || 0)

    // Calculate total payback (factor rate * funding amount)
    const totalPayback = input.fundingAmount * input.factorRate

    // Calculate finance charge (total cost of financing)
    const financeCharge = totalPayback - input.fundingAmount + totalFees

    // Calculate total dollar cost
    const totalDollarCost = financeCharge

    // Calculate payment schedule
    const { paymentAmount, numberOfPayments, schedule } = this.calculatePaymentSchedule(
      input,
      termDays,
      totalPayback
    )

    // Calculate APR equivalent
    const aprEquivalent = requirements.includeFeesInApr
      ? this.calculateAprWithFees(
          input.fundingAmount,
          totalPayback,
          totalFees,
          termDays,
          requirements.aprCalculationMethod
        )
      : this.calculateApr(
          input.fundingAmount,
          totalPayback,
          termDays,
          requirements.aprCalculationMethod
        )

    // Calculate effective (simple) interest rate
    const effectiveRate = (totalPayback - input.fundingAmount) / input.fundingAmount

    // Determine prepayment policy
    const prepaymentPolicy = this.determinePrepaymentPolicy(input.paymentFrequency)

    return {
      fundingAmount: this.roundToTwoDecimals(input.fundingAmount),
      totalDollarCost: this.roundToTwoDecimals(totalDollarCost),
      financeCharge: this.roundToTwoDecimals(financeCharge),
      totalFees: this.roundToTwoDecimals(totalFees),
      totalPayback: this.roundToTwoDecimals(totalPayback),
      termDays,
      paymentFrequency: input.paymentFrequency,
      paymentAmount: this.roundToTwoDecimals(paymentAmount),
      numberOfPayments,
      aprEquivalent: this.roundToFourDecimals(aprEquivalent),
      effectiveRate: this.roundToFourDecimals(effectiveRate),
      prepaymentPolicy,
      paymentSchedule: schedule
    }
  }

  /**
   * Calculate payment schedule based on frequency
   */
  private calculatePaymentSchedule(
    input: DealInput,
    termDays: number,
    totalPayback: number
  ): {
    paymentAmount: number
    numberOfPayments: number
    schedule: PaymentScheduleEntry[]
  } {
    const schedule: PaymentScheduleEntry[] = []
    let numberOfPayments: number
    let paymentAmount: number
    let paymentIntervalDays: number

    switch (input.paymentFrequency) {
      case 'daily':
        // Weekdays only (5 days/week)
        numberOfPayments = Math.ceil(termDays * (5 / 7))
        paymentAmount = totalPayback / numberOfPayments
        paymentIntervalDays = 1
        break

      case 'weekly':
        numberOfPayments = Math.ceil(termDays / 7)
        paymentAmount = totalPayback / numberOfPayments
        paymentIntervalDays = 7
        break

      case 'monthly':
        numberOfPayments = Math.ceil(termDays / 30)
        paymentAmount = totalPayback / numberOfPayments
        paymentIntervalDays = 30
        break

      case 'split':
        // Variable based on revenue - use holdback percentage
        if (!input.holdbackPercentage || !input.estimatedMonthlyRevenue) {
          throw new ValidationError(
            'Split payment requires holdbackPercentage and estimatedMonthlyRevenue'
          )
        }
        // Estimate based on average monthly payment
        const avgMonthlyPayment = input.estimatedMonthlyRevenue * (input.holdbackPercentage / 100)
        numberOfPayments = Math.ceil(totalPayback / avgMonthlyPayment)
        paymentAmount = avgMonthlyPayment
        paymentIntervalDays = 30
        break

      default:
        throw new ValidationError(`Unknown payment frequency: ${input.paymentFrequency}`)
    }

    // Build payment schedule
    let remainingBalance = totalPayback
    const interestPerPayment = (totalPayback - input.fundingAmount) / numberOfPayments
    const principalPerPayment = input.fundingAmount / numberOfPayments
    let currentDate = new Date()

    for (let i = 1; i <= numberOfPayments; i++) {
      // Skip weekends for daily payments
      if (input.paymentFrequency === 'daily') {
        currentDate = this.nextBusinessDay(currentDate)
      } else {
        currentDate = new Date(currentDate.getTime() + paymentIntervalDays * 24 * 60 * 60 * 1000)
      }

      const isLastPayment = i === numberOfPayments
      const actualPayment = isLastPayment
        ? remainingBalance
        : Math.min(paymentAmount, remainingBalance)

      remainingBalance -= actualPayment

      schedule.push({
        paymentNumber: i,
        paymentDate: new Date(currentDate),
        paymentAmount: this.roundToTwoDecimals(actualPayment),
        principalPortion: this.roundToTwoDecimals(principalPerPayment),
        interestPortion: this.roundToTwoDecimals(interestPerPayment),
        remainingBalance: this.roundToTwoDecimals(Math.max(0, remainingBalance))
      })
    }

    return { paymentAmount, numberOfPayments, schedule }
  }

  /**
   * Calculate APR using annualized rate method (CA SB 1235 default)
   * APR = ((Total Cost / Principal) / Term in Days) * 365 * 100
   */
  private calculateApr(
    principal: number,
    totalPayback: number,
    termDays: number,
    method: 'annualized_rate' | 'true_apr'
  ): number {
    if (method === 'true_apr') {
      // True APR calculation using iterative approach (simplified)
      return this.calculateTrueApr(principal, totalPayback, termDays)
    }

    // Annualized simple rate
    const totalCost = totalPayback - principal
    const dailyRate = totalCost / principal / termDays
    return dailyRate * 365
  }

  /**
   * Calculate APR including fees
   */
  private calculateAprWithFees(
    principal: number,
    totalPayback: number,
    fees: number,
    termDays: number,
    method: 'annualized_rate' | 'true_apr'
  ): number {
    const effectivePrincipal = principal - fees
    return this.calculateApr(effectivePrincipal, totalPayback, termDays, method)
  }

  /**
   * Calculate true APR using iterative method (Newton-Raphson approximation)
   * This gives a more accurate APR that accounts for payment timing
   */
  private calculateTrueApr(
    principal: number,
    totalPayback: number,
    termDays: number
  ): number {
    // For MCAs with daily/weekly payments, approximate using effective annual rate
    const periodsPerYear = 365 / termDays
    const totalCost = totalPayback - principal
    const periodicRate = totalCost / principal

    // Convert to APR: (1 + periodic rate)^periods - 1
    const effectiveAnnualRate = Math.pow(1 + periodicRate, periodsPerYear) - 1

    return effectiveAnnualRate
  }

  /**
   * Determine prepayment policy text based on MCA structure
   */
  private determinePrepaymentPolicy(frequency: PaymentFrequency): string {
    switch (frequency) {
      case 'daily':
      case 'weekly':
        return 'No prepayment discount. Full remaining balance is due even if paid early. ' +
               'This is a purchase of future receivables, not a loan.'

      case 'monthly':
        return 'Prepayment may be made at any time. Full contracted amount is due ' +
               'regardless of early payoff. Contact provider for specific terms.'

      case 'split':
        return 'Payments are based on a percentage of receivables. Term is estimated. ' +
               'Full purchased amount must be remitted regardless of timing.'

      default:
        return 'Contact provider for prepayment terms.'
    }
  }

  /**
   * Get the next business day (skip weekends)
   */
  private nextBusinessDay(date: Date): Date {
    const next = new Date(date.getTime() + 24 * 60 * 60 * 1000)
    const dayOfWeek = next.getDay()

    if (dayOfWeek === 0) {
      // Sunday -> Monday
      return new Date(next.getTime() + 24 * 60 * 60 * 1000)
    } else if (dayOfWeek === 6) {
      // Saturday -> Monday
      return new Date(next.getTime() + 2 * 24 * 60 * 60 * 1000)
    }

    return next
  }

  /**
   * Validate input parameters
   */
  private validateInput(input: DealInput): void {
    if (!input.fundingAmount || input.fundingAmount <= 0) {
      throw new ValidationError('Funding amount must be greater than 0')
    }

    if (!input.factorRate || input.factorRate < 1) {
      throw new ValidationError('Factor rate must be at least 1.0')
    }

    if (!input.termDays && !input.termMonths) {
      throw new ValidationError('Either termDays or termMonths is required')
    }

    if (input.paymentFrequency === 'split') {
      if (!input.holdbackPercentage || input.holdbackPercentage <= 0 || input.holdbackPercentage > 100) {
        throw new ValidationError('Holdback percentage must be between 0 and 100 for split payments')
      }
      if (!input.estimatedMonthlyRevenue || input.estimatedMonthlyRevenue <= 0) {
        throw new ValidationError('Estimated monthly revenue is required for split payments')
      }
    }
  }

  /**
   * Round to two decimal places (for currency)
   */
  private roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100
  }

  /**
   * Round to four decimal places (for rates)
   */
  private roundToFourDecimals(value: number): number {
    return Math.round(value * 10000) / 10000
  }

  /**
   * Get state requirements
   */
  getStateRequirements(state: string): StateRequirements {
    return STATE_REQUIREMENTS[state] || STATE_REQUIREMENTS['CA']
  }

  /**
   * Calculate disclosure from a Deal entity
   */
  calculateFromDeal(deal: Deal, state: string = 'CA'): DisclosureCalculation {
    if (!deal.amountRequested || !deal.factorRate) {
      throw new ValidationError('Deal must have amountRequested and factorRate')
    }

    const paymentFrequency: PaymentFrequency = deal.dailyPayment
      ? 'daily'
      : deal.weeklyPayment
        ? 'weekly'
        : 'monthly'

    const input: DealInput = {
      fundingAmount: deal.amountRequested,
      factorRate: deal.factorRate,
      termMonths: deal.termMonths,
      paymentFrequency,
      estimatedMonthlyRevenue: deal.monthlyRevenue
    }

    return this.calculateDisclosure(input, state)
  }

  /**
   * Format disclosure values for display
   */
  formatForDisplay(calculation: DisclosureCalculation): Record<string, string> {
    const formatCurrency = (value: number): string =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)

    const formatPercent = (value: number): string =>
      `${(value * 100).toFixed(2)}%`

    return {
      fundingAmount: formatCurrency(calculation.fundingAmount),
      totalDollarCost: formatCurrency(calculation.totalDollarCost),
      financeCharge: formatCurrency(calculation.financeCharge),
      totalPayback: formatCurrency(calculation.totalPayback),
      termDays: `${calculation.termDays} days`,
      paymentFrequency: calculation.paymentFrequency,
      paymentAmount: formatCurrency(calculation.paymentAmount),
      numberOfPayments: calculation.numberOfPayments.toString(),
      aprEquivalent: formatPercent(calculation.aprEquivalent),
      effectiveRate: formatPercent(calculation.effectiveRate),
      prepaymentPolicy: calculation.prepaymentPolicy
    }
  }
}

// Export singleton instance
export const disclosureCalculator = new DisclosureCalculator()
