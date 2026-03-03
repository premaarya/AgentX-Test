import { strict as assert } from 'assert';
import * as path from 'path';
import {
  validatePath,
  isTraversalAttempt,
  PathValidationResult,
} from '../../utils/pathSandbox';

const ROOT = path.resolve('/workspace/project');

// ---------------------------------------------------------------------------
// isTraversalAttempt
// ---------------------------------------------------------------------------

describe('isTraversalAttempt', () => {
  it('returns false for a clean relative path', () => {
    assert.equal(isTraversalAttempt('src/index.ts'), false);
  });

  it('returns false for a clean absolute path', () => {
    assert.equal(isTraversalAttempt('/workspace/project/src/index.ts'), false);
  });

  it('returns false for an empty string', () => {
    assert.equal(isTraversalAttempt(''), false);
  });

  it('returns true for ../ in middle', () => {
    assert.equal(isTraversalAttempt('src/../../../etc/passwd'), true);
  });

  it('returns true for ../ at start', () => {
    assert.equal(isTraversalAttempt('../sibling/file'), true);
  });

  it('returns true for ..\\ Windows separator at start', () => {
    assert.equal(isTraversalAttempt('..\\sibling\\file'), true);
  });

  it('returns true for bare .. as full path', () => {
    assert.equal(isTraversalAttempt('..'), true);
  });

  it('returns true for path ending in /..', () => {
    assert.equal(isTraversalAttempt('src/utils/..'), true);
  });

  it('returns true for repeated traversal', () => {
    assert.equal(isTraversalAttempt('a/../../b'), true);
  });

  it('returns false for a path that just contains dots in filename', () => {
    assert.equal(isTraversalAttempt('src/.eslintrc.js'), false);
  });
});

// ---------------------------------------------------------------------------
// validatePath -- workspace containment
// ---------------------------------------------------------------------------

describe('validatePath -- workspace containment', () => {
  it('allows a simple relative path inside workspace', () => {
    const result = validatePath('src/index.ts', ROOT);
    assert.equal(result.allowed, true);
    assert.ok(result.resolvedPath.startsWith(ROOT));
  });

  it('allows an absolute path that is inside workspace', () => {
    const absPath = path.join(ROOT, 'src', 'index.ts');
    const result = validatePath(absPath, ROOT);
    assert.equal(result.allowed, true);
  });

  it('blocks a relative path that escapes workspace via ../', () => {
    const result = validatePath('../../../etc/passwd', ROOT);
    assert.equal(result.allowed, false);
    assert.ok(result.reason !== undefined);
  });

  it('blocks an absolute path outside workspace', () => {
    const result = validatePath('/etc/passwd', ROOT);
    assert.equal(result.allowed, false);
    assert.ok(result.reason?.includes('outside workspace') || result.reason?.includes('traversal'));
  });

  it('resolvedPath is always populated even when blocked', () => {
    const result = validatePath('../outside.ts', ROOT);
    assert.equal(result.allowed, false);
    assert.ok(result.resolvedPath.length > 0);
  });
});

// ---------------------------------------------------------------------------
// validatePath -- blocked directories
// ---------------------------------------------------------------------------

describe('validatePath -- blocked directories', () => {
  const dirCases: Array<[string, string]> = [
    ['ssh', path.join(ROOT, '.ssh', 'id_rsa')],
    ['aws', path.join(ROOT, '.aws', 'credentials')],
    ['gnupg', path.join(ROOT, '.gnupg', 'secring.gpg')],
    ['azure', path.join(ROOT, '.azure', 'config')],
    ['kube', path.join(ROOT, '.kube', 'config')],
  ];

  for (const [label, absPath] of dirCases) {
    it(`blocks access inside .${label} directory (absolute)`, () => {
      const result = validatePath(absPath, ROOT);
      assert.equal(result.allowed, false, `Expected .${label} to be blocked`);
      assert.ok(result.reason?.includes('sensitive directory'));
    });
  }

  it('blocks access inside .config/gh directory', () => {
    const absPath = path.join(ROOT, '.config', 'gh', 'hosts.yml');
    const result = validatePath(absPath, ROOT);
    assert.equal(result.allowed, false);
    assert.ok(result.reason?.includes('sensitive directory'));
  });

  it('allows access to a safe dotfile directory', () => {
    const absPath = path.join(ROOT, '.vscode', 'settings.json');
    const result = validatePath(absPath, ROOT);
    assert.equal(result.allowed, true);
  });
});

// ---------------------------------------------------------------------------
// validatePath -- blocked file patterns
// ---------------------------------------------------------------------------

describe('validatePath -- blocked file patterns', () => {
  const fileCases: Array<[string, string]> = [
    ['.env', path.join(ROOT, '.env')],
    ['.env.local', path.join(ROOT, '.env.local')],
    ['cert.pem', path.join(ROOT, 'cert.pem')],
    ['private.key', path.join(ROOT, 'private.key')],
    ['db_password.txt', path.join(ROOT, 'db_password.txt')],
    ['app_secret.json', path.join(ROOT, 'app_secret.json')],
    ['cert.pfx', path.join(ROOT, 'cert.pfx')],
    ['keystore.p12', path.join(ROOT, 'keystore.p12')],
  ];

  for (const [filename, absPath] of fileCases) {
    it(`blocks access to ${filename}`, () => {
      const result = validatePath(absPath, ROOT);
      assert.equal(result.allowed, false, `Expected ${filename} to be blocked`);
      assert.ok(result.reason?.includes('sensitive file pattern'));
    });
  }

  it('allows access to a normal TypeScript file', () => {
    const result = validatePath('src/utils/helper.ts', ROOT);
    assert.equal(result.allowed, true);
  });

  it('allows access to a README.md', () => {
    const result = validatePath('README.md', ROOT);
    assert.equal(result.allowed, true);
  });

  it('allows access to package.json', () => {
    const result = validatePath('package.json', ROOT);
    assert.equal(result.allowed, true);
  });

  it('blocks case-insensitive match on PASSWORD in filename', () => {
    const result = validatePath(path.join(ROOT, 'MyPassword_Backup.txt'), ROOT);
    assert.equal(result.allowed, false);
  });

  it('blocks case-insensitive match on SECRET in filename', () => {
    const result = validatePath(path.join(ROOT, 'AppSecret.json'), ROOT);
    assert.equal(result.allowed, false);
  });
});

// ---------------------------------------------------------------------------
// validatePath -- result shape
// ---------------------------------------------------------------------------

describe('validatePath -- result shape', () => {
  it('returns allowed:true with resolvedPath when allowed', () => {
    const result: PathValidationResult = validatePath('src/app.ts', ROOT);
    assert.equal(result.allowed, true);
    assert.equal(result.reason, undefined);
    assert.ok(path.isAbsolute(result.resolvedPath));
  });

  it('returns allowed:false with reason when blocked', () => {
    const result: PathValidationResult = validatePath('../../../etc/passwd', ROOT);
    assert.equal(result.allowed, false);
    assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
    assert.ok(path.isAbsolute(result.resolvedPath));
  });
});
