import { describe, it, expect, beforeEach } from 'vitest'
import {
  DisclosureCalculator,
  DealInput,
  PaymentFrequency
} from '../../services/DisclosureCalculator'
import { ValidationError } from '../../errors'

describe('DisclosureCalculator', () => {
  let calculator: DisclosureCalculator

  beforeEach(() => {
    calculator = new DisclosureCalculator()
  })

  describe('calculateDisclosure', () => {
    it('should calculate disclosure for daily payment MCA', () => {
      const input: DealInput = {
        fundingAmount: 50000,
        factorRate: 1.3,
        termDays: 180,
        paymentFrequency: 'daily'
      }

      const result = calculator.calculateDisclosure(input, 'CA')

      expect(result.fundingAmount).toBe(50000)
      expect(result.totalPayback).toBe(65000) // 50000 * 1.30
      expect(result.financeCharge).toBe(15000) // 65000 - 50000
      expect(result.termDays).toBe(180)
      expect(result.paymentFrequency).toBe('daily')
      expect(result.numberOfPayments).toBeGreaterThan(0)
      expect(result.paymentAmount).toBeGreaterThan(0)
      expect(result.aprEquivalent).toBeGreaterThan(0)
    })

    it('should calculate disclosure for weekly payment MCA', () => {
      const input: DealInput = {
        fundingAmount: 75000,
        factorRate: 1.25,
        termDays: 252, // ~36 weeks
        paymentFrequency: 'weekly'
      }

      const result = calculator.calculateDisclosure(input, 'CA')

      expect(result.totalPayback).toBe(93750) // 75000 * 1.25
      expect(result.numberOfPayments).toBe(36) // 252 / 7
      expect(result.paymentFrequency).toBe('weekly')
    })

    it('should calculate disclosure for monthly payment', () => {
      const input: DealInput = {
        fundingAmount: 100000,
        factorRate: 1.2,
        termMonths: 12,
        paymentFrequency: 'monthly'
      }

      const result = calculator.calculateDisclosure(input, 'CA')

      expect(result.totalPayback).toBe(120000)
      expect(result.numberOfPayments).toBe(12)
      expect(result.termDays).toBe(360) // 12 * 30
    })

    it('should calculate disclosure for split payment MCA', () => {
      const input: DealInput = {
        fundingAmount: 50000,
        factorRate: 1.35,
        termDays: 270,
        paymentFrequency: 'split',
        holdbackPercentage: 15,
        estimatedMonthlyRevenue: 30000
      }

      const result = calculator.calculateDisclosure(input, 'CA')

      expect(result.totalPayback).toBe(67500) // 50000 * 1.35
      expect(result.paymentFrequency).toBe('split')
      // Monthly payment = 30000 * 0.15 = 4500
      expect(result.paymentAmount).toBe(4500)
    })

    it('should include fees in total cost', () => {
      const input: DealInput = {
        fundingAmount: 50000,
        factorRate: 1.3,
        termDays: 180,
        paymentFrequency: 'daily',
        originationFee: 500,
        brokerFee: 1000,
        otherFees: 250
      }

      const result = calculator.calculateDisclosure(input, 'CA')

      expect(result.totalFees).toBe(1750)
      expect(result.financeCharge).toBe(16750) // 15000 + 1750
    })

    it('should calculate prepayment policy for daily payments', () => {
      const input: DealInput = {
        fundingAmount: 50000,
        factorRate: 1.3,
        termDays: 180,
        paymentFrequency: 'daily'
      }

      const result = calculator.calculateDisclosure(input, 'CA')

      expect(result.prepaymentPolicy).toContain('No prepayment discount')
    })

    it('should calculate prepayment policy for split payments', () => {
      const input: DealInput = {
        fundingAmount: 50000,
        factorRate: 1.3,
        termDays: 180,
        paymentFrequency: 'split',
        holdbackPercentage: 15,
        estimatedMonthlyRevenue: 30000
      }

      const result = calculator.calculateDisclosure(input, 'CA')

      expect(result.prepaymentPolicy).toContain('percentage of receivables')
    })
  })

  describe('calculateDisclosure with state differences', () => {
    it('should use CA requirements by default', () => {
      const input: DealInput = {
        fundingAmount: 50000,
        factorRate: 1.3,
        termDays: 180,
        paymentFrequency: 'daily'
      }

      const caResult = calculator.calculateDisclosure(input, 'CA')
      const defaultResult = calculator.calculateDisclosure(input)

      expect(caResult.aprEquivalent).toBe(defaultResult.aprEquivalent)
    })

    it('should use NY requirements with fees in APR', () => {
      const input: DealInput = {
        fundingAmount: 50000,
        factorRate: 1.3,
        termDays: 180,
        paymentFrequency: 'daily',
        originationFee: 1000
      }

      const caResult = calculator.calculateDisclosure(input, 'CA')
      const nyResult = calculator.calculateDisclosure(input, 'NY')

      // NY includes fees in APR, so APR should be higher
      expect(nyResult.aprEquivalent).toBeGreaterThan(caResult.aprEquivalent)
    })
  })

  describe('validation', () => {
    it('should throw ValidationError for missing funding amount', () => {
      const input = {
        fundingAmount: 0,
        factorRate: 1.3,
        termDays: 180,
        paymentFrequency: 'daily' as PaymentFrequency
      }

      expect(() => calculator.calculateDisclosure(input)).toThrow(ValidationError)
    })

    it('should throw ValidationError for factor rate less than 1', () => {
      const input: DealInput = {
        fundingAmount: 50000,
        factorRate: 0.95,
        termDays: 180,
        paymentFrequency: 'daily'
      }

      expect(() => calculator.calculateDisclosure(input)).toThrow(ValidationError)
    })

    it('should throw ValidationError for missing term', () => {
      const input = {
        fundingAmount: 50000,
        factorRate: 1.3,
        paymentFrequency: 'daily' as PaymentFrequency
      }

      expect(() => calculator.calculateDisclosure(input)).toThrow(ValidationError)
    })

    it('should throw ValidationError for split payment without holdback', () => {
      const input: DealInput = {
        fundingAmount: 50000,
        factorRate: 1.3,
        termDays: 180,
        paymentFrequency: 'split',
        estimatedMonthlyRevenue: 30000
      }

      expect(() => calculator.calculateDisclosure(input)).toThrow(ValidationError)
    })

    it('should throw ValidationError for split payment without monthly revenue', () => {
      const input: DealInput = {
        fundingAmount: 50000,
        factorRate: 1.3,
        termDays: 180,
        paymentFrequency: 'split',
        holdbackPercentage: 15
      }

      expect(() => calculator.calculateDisclosure(input)).toThrow(ValidationError)
    })

    it('should throw ValidationError for holdback percentage out of range', () => {
      const input: DealInput = {
        fundingAmount: 50000,
        factorRate: 1.3,
        termDays: 180,
        paymentFrequency: 'split',
        holdbackPercentage: 150,
        estimatedMonthlyRevenue: 30000
      }

      expect(() => calculator.calculateDisclosure(input)).toThrow(ValidationError)
    })
  })

  describe('calculateFromDeal', () => {
    it('should calculate from Deal entity with daily payment', () => {
      const deal = {
        id: 'deal-1',
        amountRequested: 50000,
        factorRate: 1.3,
        termMonths: 6,
        dailyPayment: 350
      }

      const result = calculator.calculateFromDeal(
        deal as unknown as Parameters<typeof calculator.calculateFromDeal>[0],
        'CA'
      )

      expect(result.fundingAmount).toBe(50000)
      expect(result.paymentFrequency).toBe('daily')
    })

    it('should calculate from Deal entity with weekly payment', () => {
      const deal = {
        id: 'deal-1',
        amountRequested: 50000,
        factorRate: 1.3,
        termMonths: 6,
        weeklyPayment: 1500
      }

      const result = calculator.calculateFromDeal(
        deal as unknown as Parameters<typeof calculator.calculateFromDeal>[0],
        'CA'
      )

      expect(result.paymentFrequency).toBe('weekly')
    })

    it('should throw ValidationError for deal without required fields', () => {
      const deal = {
        id: 'deal-1',
        amountRequested: 50000
      }

      expect(() =>
        calculator.calculateFromDeal(
          deal as unknown as Parameters<typeof calculator.calculateFromDeal>[0]
        )
      ).toThrow(ValidationError)
    })
  })

  describe('formatForDisplay', () => {
    it('should format calculation values for display', () => {
      const input: DealInput = {
        fundingAmount: 50000,
        factorRate: 1.3,
        termDays: 180,
        paymentFrequency: 'daily'
      }

      const calculation = calculator.calculateDisclosure(input)
      const formatted = calculator.formatForDisplay(calculation)

      expect(formatted.fundingAmount).toBe('$50,000.00')
      expect(formatted.totalPayback).toBe('$65,000.00')
      expect(formatted.termDays).toBe('180 days')
      expect(formatted.aprEquivalent).toContain('%')
    })
  })

  describe('getStateRequirements', () => {
    it('should return CA requirements', () => {
      const requirements = calculator.getStateRequirements('CA')

      expect(requirements.state).toBe('CA')
      expect(requirements.regulationName).toBe('SB 1235')
      expect(requirements.requiresApr).toBe(true)
      expect(requirements.includeFeesInApr).toBe(false)
    })

    it('should return NY requirements', () => {
      const requirements = calculator.getStateRequirements('NY')

      expect(requirements.state).toBe('NY')
      expect(requirements.regulationName).toBe('CFDL')
      expect(requirements.includeFeesInApr).toBe(true)
    })

    it('should return CA requirements for unknown state', () => {
      const requirements = calculator.getStateRequirements('AZ')

      expect(requirements.state).toBe('CA')
    })
  })

  describe('payment schedule', () => {
    it('should generate payment schedule with correct length', () => {
      const input: DealInput = {
        fundingAmount: 10000,
        factorRate: 1.2,
        termDays: 60,
        paymentFrequency: 'daily'
      }

      const result = calculator.calculateDisclosure(input)

      expect(result.paymentSchedule.length).toBe(result.numberOfPayments)
    })

    it('should have remaining balance of zero on last payment', () => {
      const input: DealInput = {
        fundingAmount: 10000,
        factorRate: 1.2,
        termDays: 60,
        paymentFrequency: 'daily'
      }

      const result = calculator.calculateDisclosure(input)
      const lastPayment = result.paymentSchedule[result.paymentSchedule.length - 1]

      expect(lastPayment.remainingBalance).toBe(0)
    })

    it('should have sequential payment numbers', () => {
      const input: DealInput = {
        fundingAmount: 10000,
        factorRate: 1.2,
        termDays: 30,
        paymentFrequency: 'weekly'
      }

      const result = calculator.calculateDisclosure(input)

      result.paymentSchedule.forEach((payment, index) => {
        expect(payment.paymentNumber).toBe(index + 1)
      })
    })
  })

  describe('APR calculations', () => {
    it('should calculate annualized rate for CA', () => {
      const input: DealInput = {
        fundingAmount: 10000,
        factorRate: 1.3,
        termDays: 365,
        paymentFrequency: 'daily'
      }

      const result = calculator.calculateDisclosure(input, 'CA')

      // 30% cost over 365 days = ~30% APR for annualized rate
      expect(result.aprEquivalent).toBeCloseTo(0.3, 1)
    })

    it('should calculate higher APR for shorter terms', () => {
      const shortTerm: DealInput = {
        fundingAmount: 10000,
        factorRate: 1.3,
        termDays: 90,
        paymentFrequency: 'daily'
      }

      const longTerm: DealInput = {
        fundingAmount: 10000,
        factorRate: 1.3,
        termDays: 365,
        paymentFrequency: 'daily'
      }

      const shortResult = calculator.calculateDisclosure(shortTerm)
      const longResult = calculator.calculateDisclosure(longTerm)

      expect(shortResult.aprEquivalent).toBeGreaterThan(longResult.aprEquivalent)
    })
  })

  describe('effective rate', () => {
    it('should calculate simple effective rate', () => {
      const input: DealInput = {
        fundingAmount: 10000,
        factorRate: 1.3,
        termDays: 180,
        paymentFrequency: 'daily'
      }

      const result = calculator.calculateDisclosure(input)

      // Effective rate = (totalPayback - principal) / principal
      expect(result.effectiveRate).toBeCloseTo(0.3, 2)
    })
  })
})
