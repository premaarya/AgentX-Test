// copy-assets.js - Copies AgentX .github assets into the extension for packaging.
// This ensures agents, instructions, prompts, and skills are bundled in the VSIX
// and available across all workspaces.
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const srcRoot = path.resolve(repoRoot, '.github');
const destRoot = path.resolve(__dirname, '..', '.github', 'agentx');

// Directories from .github/ to bundle
const githubDirs = ['agents', 'instructions', 'prompts', 'skills', 'templates', 'schemas', 'security', 'ISSUE_TEMPLATE'];

// Directories from repo root to bundle
const rootDirs = [
    { src: path.join(repoRoot, 'packs'), dest: 'packs' },
];

// Standalone files from .github/ to bundle
const standaloneFiles = ['agent-delegation.md', 'agentx-security.yml', 'CODEOWNERS', 'PULL_REQUEST_TEMPLATE.md', 'copilot-instructions.md'];

// Root-level reference documents to bundle alongside .github/ assets
const rootDocs = ['AGENTS.md', 'Skills.md'];

// Root-level runtime files that extension-installed workspaces rely on
const rootRuntimeFiles = [
    { src: path.join(repoRoot, '.agentx', 'agentx.ps1'), dest: path.join('.agentx', 'agentx.ps1') },
    { src: path.join(repoRoot, '.agentx', 'agentx-cli.ps1'), dest: path.join('.agentx', 'agentx-cli.ps1') },
    { src: path.join(repoRoot, '.agentx', 'agentx.sh'), dest: path.join('.agentx', 'agentx.sh') },
    { src: path.join(repoRoot, '.agentx', 'local-issue-manager.ps1'), dest: path.join('.agentx', 'local-issue-manager.ps1') },
    { src: path.join(repoRoot, '.agentx', 'local-issue-manager.sh'), dest: path.join('.agentx', 'local-issue-manager.sh') },
];

// docs/ reference files referenced by agents (bundled to docs/ subdirectory)
const docFiles = ['WORKFLOW.md', 'GUIDE.md', 'GOLDEN_PRINCIPLES.md', 'QUALITY_SCORE.md', 'tech-debt-tracker.md'];

const bundledMarkdownRewrites = [
    {
        relativePath: 'Skills.md',
        replacements: [
            ['(.github/skills/', '(skills/'],
            ['|.github/skills/', '|skills/'],
        ],
    },
    {
        relativePath: path.join('docs', 'WORKFLOW.md'),
        replacements: [
            ['(../.github/templates/', '(../templates/'],
            ['(../.github/agents/', '(../agents/'],
            ['(../.github/skills/', '(../skills/'],
        ],
    },
];

// Clean destination
if (fs.existsSync(destRoot)) {
    fs.rmSync(destRoot, { recursive: true });
}

let totalFiles = 0;

// Copy .github subdirectories
for (const dir of githubDirs) {
    const src = path.join(srcRoot, dir);
    const dest = path.join(destRoot, dir);
    if (fs.existsSync(src)) {
        fs.cpSync(src, dest, { recursive: true });
        const count = countFiles(dest);
        totalFiles += count;
        console.log('  Copied ' + dir + '/ (' + count + ' files)');
    } else {
        console.log('  [WARN] Source not found: ' + dir + '/');
    }
}

// Copy root-level directories
for (const entry of rootDirs) {
    if (fs.existsSync(entry.src)) {
        const dest = path.join(destRoot, entry.dest);
        fs.cpSync(entry.src, dest, { recursive: true });
        const count = countFiles(dest);
        totalFiles += count;
        console.log('  Copied ' + entry.dest + '/ (' + count + ' files)');
    } else {
        console.log('  [WARN] Source not found: ' + entry.dest + '/');
    }
}

// Copy standalone files
for (const file of standaloneFiles) {
    const src = path.join(srcRoot, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(destRoot, file));
        totalFiles++;
    }
}
if (standaloneFiles.length > 0) {
    console.log('  Copied ' + standaloneFiles.length + ' standalone files');
}

// Copy root-level reference documents
let rootDocCount = 0;
for (const file of rootDocs) {
    const src = path.join(repoRoot, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(destRoot, file));
        totalFiles++;
        rootDocCount++;
    }
}
if (rootDocCount > 0) {
    console.log('  Copied ' + rootDocCount + ' root docs');
}

// Copy root runtime files
let runtimeFileCount = 0;
for (const file of rootRuntimeFiles) {
    if (fs.existsSync(file.src)) {
        const destFile = path.join(destRoot, file.dest);
        fs.mkdirSync(path.dirname(destFile), { recursive: true });
        fs.copyFileSync(file.src, destFile);
        totalFiles++;
        runtimeFileCount++;
    }
}
if (runtimeFileCount > 0) {
    console.log('  Copied ' + runtimeFileCount + ' runtime files');
}

// Copy docs/ reference files to docs/ subdirectory
const docsDestDir = path.join(destRoot, 'docs');
if (!fs.existsSync(docsDestDir)) {
    fs.mkdirSync(docsDestDir, { recursive: true });
}
let docFileCount = 0;
for (const file of docFiles) {
    const src = path.join(repoRoot, 'docs', file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(docsDestDir, file));
        totalFiles++;
        docFileCount++;
    }
}
if (docFileCount > 0) {
    console.log('  Copied ' + docFileCount + ' docs/ reference files');
}

applyBundledMarkdownRewrites();

console.log('Done: ' + totalFiles + ' files copied to .github/agentx/');

function countFiles(dir) {
    let count = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            count += countFiles(path.join(dir, entry.name));
        } else {
            count++;
        }
    }
    return count;
}

function applyBundledMarkdownRewrites() {
    let rewrittenFileCount = 0;

    for (const entry of bundledMarkdownRewrites) {
        const targetPath = path.join(destRoot, entry.relativePath);
        if (!fs.existsSync(targetPath)) {
            continue;
        }

        const original = fs.readFileSync(targetPath, 'utf8');
        let updated = original;

        for (const [from, to] of entry.replacements) {
            updated = updated.split(from).join(to);
        }

        if (updated !== original) {
            fs.writeFileSync(targetPath, updated, 'utf8');
            rewrittenFileCount++;
        }
    }

    if (rewrittenFileCount > 0) {
        console.log('  Rewrote bundled markdown links in ' + rewrittenFileCount + ' files');
    }
}
