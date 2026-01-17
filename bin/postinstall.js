#!/usr/bin/env node

/**
 * Post-install script for AgentX
 * Displays welcome message after npm install
 */

const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m'
};

console.log(`
${COLORS.cyan}╔═══════════════════════════════════════════════════════════════╗
║                                                                 ║
║   ${COLORS.bright}AgentX${COLORS.reset}${COLORS.cyan} installed successfully! 🚀                        ║
║                                                                 ║
╚═══════════════════════════════════════════════════════════════╝${COLORS.reset}

${COLORS.bright}Quick Start:${COLORS.reset}
  ${COLORS.cyan}npx agentx-copilot init${COLORS.reset}        Initialize in your project
  ${COLORS.cyan}npx agentx-copilot init --full${COLORS.reset} Initialize with all files
  ${COLORS.cyan}npx agentx-copilot doctor${COLORS.reset}      Check configuration health

${COLORS.bright}Documentation:${COLORS.reset}
  ${COLORS.yellow}https://github.com/jnPiyush/AgentX${COLORS.reset}
`);
