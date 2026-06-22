// Facade for SMS template generators.
// Implementations live in ./template-parts/*; this file wires them together
// and exposes the public surface (generateSMSMessage, generateDailyReportV2).
import { generateRecurringTransactionsMessage } from './template-parts/recurring';
import { generateRecentTransactionsMessage } from './template-parts/recent';
import {
  generatePacingAnalysisMessage,
  generateMerchantPacingMessage,
  generateCategoryPacingMessage,
} from './template-parts/pacing';
import {
  generateWeeklySpendingSummaryMessage,
  generateMonthlySpendingSummaryMessage,
} from './template-parts/summaries';
import { generateCashFlowRunwayMessage } from './template-parts/cash-flow';
import {
  generateOnboardingImmediateMessage,
  generateOnboardingAnalysisCompleteMessage,
  generateOnboardingDayBeforeMessage,
} from './template-parts/onboarding';
import { generateMorningExpensesMessage } from './template-parts/morning-expenses';
import { generate415pmSpecialMessage } from './template-parts/daily-415pm';
import { generateDailyReportV2 } from './template-parts/daily-report-v2';
import { generateBOGODinnerPlanSMS } from './template-parts/bogo';

export {
  generateRecurringTransactionsMessage,
  generateRecentTransactionsMessage,
  generatePacingAnalysisMessage,
  generateMerchantPacingMessage,
  generateCategoryPacingMessage,
  generateWeeklySpendingSummaryMessage,
  generateMonthlySpendingSummaryMessage,
  generateCashFlowRunwayMessage,
  generateOnboardingImmediateMessage,
  generateOnboardingAnalysisCompleteMessage,
  generateOnboardingDayBeforeMessage,
  generateMorningExpensesMessage,
  generate415pmSpecialMessage,
  generateDailyReportV2,
  generateBOGODinnerPlanSMS,
};

export async function generateSMSMessage(userId: string, templateType: 'recurring' | 'recent' | 'activity' | 'merchant-pacing' | 'category-pacing' | 'weekly-summary' | 'monthly-summary' | 'cash-flow-runway' | 'onboarding-immediate' | 'onboarding-analysis-complete' | 'onboarding-day-before' | '415pm-special' | 'bogo-dinner-plan' | 'morning-expenses', force415pmReport: boolean = false): Promise<string> {
  switch (templateType) {
    case 'recurring':
      return await generateRecurringTransactionsMessage(userId);
    case 'recent':
      return await generateRecentTransactionsMessage(userId, force415pmReport);
    case 'activity':
      return await generateRecentTransactionsMessage(userId, force415pmReport);
    case 'merchant-pacing':
      return await generateMerchantPacingMessage(userId);
    case 'category-pacing':
      return await generateCategoryPacingMessage(userId);
    case 'weekly-summary':
      return await generateWeeklySpendingSummaryMessage(userId);
    case 'monthly-summary':
      return await generateMonthlySpendingSummaryMessage(userId);
    case 'cash-flow-runway':
      return await generateCashFlowRunwayMessage(userId);
    case 'onboarding-immediate':
      return await generateOnboardingImmediateMessage(userId);
    case 'onboarding-analysis-complete':
      return await generateOnboardingAnalysisCompleteMessage(userId);
    case 'onboarding-day-before':
      return await generateOnboardingDayBeforeMessage(userId);
    case '415pm-special':
      // Align manual sends with on-screen preview and cron: use V2
      return await generateDailyReportV2(userId);
    case 'bogo-dinner-plan':
      return await generateBOGODinnerPlanSMS();
    case 'morning-expenses':
      return await generateMorningExpensesMessage(userId);
    // TEMPORARILY DISABLED - Paycheck templates
    // case 'paycheck-efficiency':
    //   return await generateSMSMessageForUser(userId, 'paycheck-efficiency');
    default:
      return "📱 Krezzo\n\nInvalid template type.";
  }
} 
