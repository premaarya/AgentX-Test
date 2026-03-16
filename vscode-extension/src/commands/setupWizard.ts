import { AgentXContext } from '../agentxContext';
import {
  runCriticalPreCheckFlow,
  runSetupWizardFlow,
  runSilentInstallFlow,
  runStartupCheckFlow,
} from './setupWizardInternals';
import { PreCheckResult } from './setupWizardTypes';

export type { PreCheckResult } from './setupWizardTypes';

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

/**
 * Run the full environment check and present an interactive report.
 * Called by the `agentx.checkEnvironment` command and on first activation.
 */
export async function runSetupWizard(agentx: AgentXContext): Promise<void> {
  await runSetupWizardFlow(agentx);
}

/**
 * Lightweight startup check - runs silently after activation and only
 * surfaces an advisory notification when critical problems are detected.
 * Missing required dependencies are routed to the explicit environment wizard
 * instead of starting installs automatically during activation.
 */
export async function runStartupCheck(agentx: AgentXContext): Promise<void> {
  await runStartupCheckFlow(agentx);
}

/**
 * Silently install all missing required dependencies without any user prompts.
 *
 * Checks all dependencies, then auto-installs any missing required tools
 * via a hidden terminal. A progress notification tracks the install. If all
 * tools are already present, resolves immediately with `passed: true`.
 *
 * @param mode - The AgentX operating provider ('local', 'github', or 'ado').
 * @returns PreCheckResult - `passed` is true when all required deps
 *   are satisfied after the silent install attempt.
 */
export async function runSilentInstall(agentx: AgentXContext): Promise<PreCheckResult> {
  return runSilentInstallFlow(agentx);
}

// -----------------------------------------------------------------------
//  Critical Pre-Check - auto-installs missing required dependencies
// -----------------------------------------------------------------------

/**
 * Check every required dependency and, if any are missing, prompt the user
 * to install them automatically. VS Code extensions are installed via the
 * Extensions API; external CLI tools are installed via a terminal.
 *
 * @param agentx  - The AgentX context for integration detection.
 * @param blocking - When true (default), shows a modal dialog that demands
 *   action before the user can continue. When false, uses a
 *   non-modal warning (suitable for background startup checks).
 * @returns PreCheckResult - `passed` is true when all required deps
 *   are satisfied (either already present or successfully installed).
 */
export async function runCriticalPreCheck(
  agentx: AgentXContext,
  blocking = true,
): Promise<PreCheckResult> {
  return runCriticalPreCheckFlow(agentx, blocking);
}
