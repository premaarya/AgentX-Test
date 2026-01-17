#!/usr/bin/env node

/**
 * AgentX CLI - AI Agent Guidelines for Production Code
 * 
 * Usage:
 *   npx agentx-copilot init          Initialize AgentX in current project
 *   npx agentx-copilot init --full   Initialize with all optional files
 *   npx agentx-copilot update        Update existing AgentX installation
 *   npx agentx-copilot doctor        Check AgentX configuration health
 */

const fs = require('fs');
const path = require('path');

const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

const log = {
    info: (msg) => console.log(`${COLORS.blue}ℹ${COLORS.reset} ${msg}`),
    success: (msg) => console.log(`${COLORS.green}✓${COLORS.reset} ${msg}`),
    warn: (msg) => console.log(`${COLORS.yellow}⚠${COLORS.reset} ${msg}`),
    error: (msg) => console.log(`${COLORS.red}✗${COLORS.reset} ${msg}`),
    title: (msg) => console.log(`\n${COLORS.bright}${COLORS.cyan}${msg}${COLORS.reset}\n`)
};

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const TARGET_ROOT = process.cwd();

// Core files that are always installed
const CORE_FILES = [
    { src: 'Agents.md', dest: 'Agents.md' },
    { src: 'Skills.md', dest: 'Skills.md' },
    { src: 'templates/.github/copilot-instructions.md', dest: '.github/copilot-instructions.md' },
    { src: 'templates/.github/autonomous-mode.yml', dest: '.github/autonomous-mode.yml' }
];

// Skills directory
const SKILLS_DIR = 'skills';

// Optional files for --full installation
const OPTIONAL_FILES = [
    { src: 'templates/.github/agents/architect.agent.md', dest: '.github/agents/architect.agent.md' },
    { src: 'templates/.github/agents/engineer.agent.md', dest: '.github/agents/engineer.agent.md' },
    { src: 'templates/.github/agents/reviewer.agent.md', dest: '.github/agents/reviewer.agent.md' },
    { src: 'templates/.github/agents/ux-designer.agent.md', dest: '.github/agents/ux-designer.agent.md' },
    { src: 'templates/.github/instructions/csharp.instructions.md', dest: '.github/instructions/csharp.instructions.md' },
    { src: 'templates/.github/instructions/python.instructions.md', dest: '.github/instructions/python.instructions.md' },
    { src: 'templates/.github/instructions/react.instructions.md', dest: '.github/instructions/react.instructions.md' },
    { src: 'templates/.github/instructions/api.instructions.md', dest: '.github/instructions/api.instructions.md' },
    { src: 'templates/.github/prompts/code-review.prompt.md', dest: '.github/prompts/code-review.prompt.md' },
    { src: 'templates/.github/prompts/refactor.prompt.md', dest: '.github/prompts/refactor.prompt.md' },
    { src: 'templates/.github/prompts/test-gen.prompt.md', dest: '.github/prompts/test-gen.prompt.md' }
];

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function copyFile(src, dest, overwrite = false) {
    const srcPath = path.join(PACKAGE_ROOT, src);
    const destPath = path.join(TARGET_ROOT, dest);
    
    if (!fs.existsSync(srcPath)) {
        log.warn(`Source file not found: ${src}`);
        return false;
    }
    
    if (fs.existsSync(destPath) && !overwrite) {
        log.warn(`Skipped (exists): ${dest}`);
        return false;
    }
    
    ensureDir(path.dirname(destPath));
    fs.copyFileSync(srcPath, destPath);
    log.success(`Created: ${dest}`);
    return true;
}

function copyDirectory(src, dest, overwrite = false) {
    const srcPath = path.join(PACKAGE_ROOT, src);
    const destPath = path.join(TARGET_ROOT, dest);
    
    if (!fs.existsSync(srcPath)) {
        log.warn(`Source directory not found: ${src}`);
        return;
    }
    
    ensureDir(destPath);
    
    const items = fs.readdirSync(srcPath);
    for (const item of items) {
        const srcItem = path.join(srcPath, item);
        const destItem = path.join(destPath, item);
        
        if (fs.statSync(srcItem).isDirectory()) {
            copyDirectory(path.join(src, item), path.join(dest, item), overwrite);
        } else {
            copyFile(path.join(src, item), path.join(dest, item), overwrite);
        }
    }
}

function detectProjectType() {
    const indicators = {
        dotnet: ['*.csproj', '*.sln', '*.cs'].some(p => 
            fs.readdirSync(TARGET_ROOT).some(f => f.endsWith(p.replace('*', '')))),
        python: fs.existsSync(path.join(TARGET_ROOT, 'requirements.txt')) || 
                fs.existsSync(path.join(TARGET_ROOT, 'pyproject.toml')) ||
                fs.existsSync(path.join(TARGET_ROOT, 'setup.py')),
        node: fs.existsSync(path.join(TARGET_ROOT, 'package.json')),
        react: false // Will be detected from package.json
    };
    
    if (indicators.node) {
        try {
            const pkg = JSON.parse(fs.readFileSync(path.join(TARGET_ROOT, 'package.json'), 'utf8'));
            indicators.react = !!(pkg.dependencies?.react || pkg.devDependencies?.react);
        } catch (e) {}
    }
    
    return indicators;
}

function showBanner() {
    console.log(`
${COLORS.cyan}╔═══════════════════════════════════════════════════════════════╗
║                                                                 ║
║   ${COLORS.bright}AgentX${COLORS.reset}${COLORS.cyan} - AI Agent Guidelines for Production Code         ║
║                                                                 ║
║   Dynamic Multi-agent Workflow & Enterprise-grade Standards     ║
║                                                                 ║
╚═══════════════════════════════════════════════════════════════╝${COLORS.reset}
`);
}

function init(options = {}) {
    const { full = false, overwrite = false } = options;
    
    showBanner();
    log.title('Initializing AgentX in your project...');
    
    // Check if git repo
    if (!fs.existsSync(path.join(TARGET_ROOT, '.git'))) {
        log.warn('Not a git repository. Some features may not work.');
        log.info('Run "git init" to initialize a git repository.');
    }
    
    // Install core files
    log.info('Installing core files...');
    for (const file of CORE_FILES) {
        copyFile(file.src, file.dest, overwrite);
    }
    
    // Install skills directory
    log.info('Installing skills documentation...');
    copyDirectory(SKILLS_DIR, SKILLS_DIR, overwrite);
    
    // Install optional files for full installation
    if (full) {
        log.info('Installing optional files (--full mode)...');
        for (const file of OPTIONAL_FILES) {
            copyFile(file.src, file.dest, overwrite);
        }
    }
    
    // Detect project type and suggest relevant instructions
    log.info('Detecting project type...');
    const projectType = detectProjectType();
    
    const suggestions = [];
    if (projectType.dotnet) suggestions.push('.github/instructions/csharp.instructions.md');
    if (projectType.python) suggestions.push('.github/instructions/python.instructions.md');
    if (projectType.react) suggestions.push('.github/instructions/react.instructions.md');
    if (projectType.node) suggestions.push('.github/instructions/api.instructions.md');
    
    if (suggestions.length > 0 && !full) {
        log.info('\nDetected project types. Consider adding these instruction files:');
        suggestions.forEach(s => console.log(`   ${COLORS.yellow}→${COLORS.reset} ${s}`));
        console.log(`\n   Run ${COLORS.cyan}npx agentx-copilot init --full${COLORS.reset} to install all files.`);
    }
    
    // Create GitHub labels command
    log.title('Next Steps');
    console.log(`1. Review and customize ${COLORS.cyan}.github/autonomous-mode.yml${COLORS.reset}`);
    console.log(`2. Add your GitHub username to the allowed_actors list`);
    console.log(`3. Create GitHub labels by running:`);
    console.log(`
   ${COLORS.yellow}gh label create "type:task" --description "Atomic unit of work" --color "0E8A16"
   gh label create "type:feature" --description "User-facing capability" --color "A2EEEF"
   gh label create "type:bug" --description "Defect to fix" --color "D73A4A"
   gh label create "status:ready" --description "No blockers, can start" --color "C2E0C6"
   gh label create "status:in-progress" --description "Currently working" --color "FBCA04"
   gh label create "status:done" --description "Completed" --color "0E8A16"
   gh label create "priority:p0" --description "Critical - do immediately" --color "B60205"
   gh label create "priority:p1" --description "High - do next" --color "D93F0B"${COLORS.reset}
`);
    console.log(`4. Read ${COLORS.cyan}Agents.md${COLORS.reset} for workflow guidelines`);
    console.log(`5. Check ${COLORS.cyan}Skills.md${COLORS.reset} for production standards\n`);
    
    log.success('AgentX initialized successfully! 🚀\n');
}

function update(options = {}) {
    showBanner();
    log.title('Updating AgentX files...');
    
    // Update core files (overwrite)
    for (const file of CORE_FILES) {
        copyFile(file.src, file.dest, true);
    }
    
    // Update skills
    copyDirectory(SKILLS_DIR, SKILLS_DIR, true);
    
    log.success('AgentX updated successfully!\n');
}

function doctor() {
    showBanner();
    log.title('Checking AgentX configuration health...');
    
    let issues = 0;
    let warnings = 0;
    
    // Check core files
    const requiredFiles = [
        'Agents.md',
        'Skills.md',
        '.github/copilot-instructions.md',
        '.github/autonomous-mode.yml'
    ];
    
    for (const file of requiredFiles) {
        const filePath = path.join(TARGET_ROOT, file);
        if (fs.existsSync(filePath)) {
            log.success(`Found: ${file}`);
        } else {
            log.error(`Missing: ${file}`);
            issues++;
        }
    }
    
    // Check skills directory
    const skillsPath = path.join(TARGET_ROOT, 'skills');
    if (fs.existsSync(skillsPath)) {
        const skills = fs.readdirSync(skillsPath).filter(f => f.endsWith('.md'));
        log.success(`Found ${skills.length} skill files in skills/`);
    } else {
        log.error('Missing: skills/ directory');
        issues++;
    }
    
    // Check git
    if (!fs.existsSync(path.join(TARGET_ROOT, '.git'))) {
        log.warn('Not a git repository');
        warnings++;
    } else {
        log.success('Git repository detected');
    }
    
    // Check GitHub CLI
    const { execSync } = require('child_process');
    try {
        execSync('gh --version', { stdio: 'pipe' });
        log.success('GitHub CLI (gh) is installed');
    } catch (e) {
        log.warn('GitHub CLI (gh) not found - task management features will be limited');
        warnings++;
    }
    
    // Check autonomous-mode.yml for username
    const autonomousPath = path.join(TARGET_ROOT, '.github/autonomous-mode.yml');
    if (fs.existsSync(autonomousPath)) {
        const content = fs.readFileSync(autonomousPath, 'utf8');
        if (content.includes('# - "your-username"')) {
            log.warn('autonomous-mode.yml: Add your GitHub username to allowed_actors');
            warnings++;
        }
    }
    
    // Summary
    log.title('Health Check Summary');
    if (issues === 0 && warnings === 0) {
        log.success('All checks passed! AgentX is properly configured. 🎉');
    } else {
        if (issues > 0) log.error(`${issues} issue(s) found`);
        if (warnings > 0) log.warn(`${warnings} warning(s) found`);
        console.log(`\nRun ${COLORS.cyan}npx agentx-copilot init${COLORS.reset} to fix missing files.`);
    }
    console.log();
}

function showHelp() {
    showBanner();
    console.log(`${COLORS.bright}Usage:${COLORS.reset}
  npx agentx-copilot <command> [options]

${COLORS.bright}Commands:${COLORS.reset}
  init              Initialize AgentX in current project
  init --full       Initialize with all optional files (agents, instructions, prompts)
  init --overwrite  Overwrite existing files
  update            Update existing AgentX installation
  doctor            Check AgentX configuration health
  help              Show this help message

${COLORS.bright}Examples:${COLORS.reset}
  ${COLORS.cyan}npx agentx-copilot init${COLORS.reset}
    Initialize AgentX with core files

  ${COLORS.cyan}npx agentx-copilot init --full${COLORS.reset}
    Initialize with all agent roles, instructions, and prompts

  ${COLORS.cyan}npx agentx-copilot doctor${COLORS.reset}
    Check if AgentX is properly configured

${COLORS.bright}Documentation:${COLORS.reset}
  GitHub:  https://github.com/jnPiyush/AgentX
  Issues:  https://github.com/jnPiyush/AgentX/issues
`);
}

// Parse arguments
const args = process.argv.slice(2);
const command = args[0];
const options = {
    full: args.includes('--full'),
    overwrite: args.includes('--overwrite')
};

switch (command) {
    case 'init':
        init(options);
        break;
    case 'update':
        update(options);
        break;
    case 'doctor':
        doctor();
        break;
    case 'help':
    case '--help':
    case '-h':
        showHelp();
        break;
    default:
        if (command) {
            log.error(`Unknown command: ${command}`);
        }
        showHelp();
        process.exit(command ? 1 : 0);
}
