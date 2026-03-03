import { strict as assert } from 'assert';
import { redactSecrets, isRedactionNeeded } from '../../utils/secretRedactor';

// ---------------------------------------------------------------------------
// isRedactionNeeded
// ---------------------------------------------------------------------------

describe('isRedactionNeeded', () => {
  it('should return false for clean strings', () => {
    assert.equal(isRedactionNeeded('hello world'), false);
    assert.equal(isRedactionNeeded('git status'), false);
    assert.equal(isRedactionNeeded(''), false);
    assert.equal(isRedactionNeeded('npm install'), false);
  });

  it('should return true when bearer header is present', () => {
    assert.equal(isRedactionNeeded('Authorization: Bearer abc123'), true);
  });

  it('should return true when an OpenAI key prefix is present', () => {
    assert.equal(isRedactionNeeded('key: sk-abcdefghijklmnopqrstuv'), true);
  });

  it('should return true when a github token prefix is present', () => {
    assert.equal(isRedactionNeeded('ghp_sometoken'), true);
  });

  it('should return true for password assignment', () => {
    assert.equal(isRedactionNeeded('password=supersecret123'), true);
  });
});

// ---------------------------------------------------------------------------
// redactSecrets -- bearer tokens
// ---------------------------------------------------------------------------

describe('redactSecrets - bearer tokens', () => {
  it('should redact a bearer token', () => {
    const input = 'Authorization: Bearer eyABC123def456==';
    const result = redactSecrets(input);
    assert.ok(!result.includes('eyABC123def456'), 'raw token should be removed');
    assert.ok(result.includes('[REDACTED:bearer]'), 'placeholder should be present');
  });

  it('should redact bearer token regardless of case', () => {
    const input = 'authorization: BEARER tokenvalue1234==';
    const result = redactSecrets(input);
    assert.ok(result.includes('[REDACTED:bearer]'));
  });

  it('should not alter text with the word "bearer" but no token', () => {
    // "Bearer" alone without a following token should not match
    const input = 'The bearer of bad news';
    const result = redactSecrets(input);
    assert.equal(result, input);
  });
});

// ---------------------------------------------------------------------------
// redactSecrets -- JWT
// ---------------------------------------------------------------------------

describe('redactSecrets - JWT tokens', () => {
  it('should redact a well-formed JWT', () => {
    const header  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const payload = 'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ';
    const sig     = 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const jwt = `${header}.${payload}.${sig}`;
    const result = redactSecrets(`token=${jwt}`);
    assert.ok(!result.includes(header), 'JWT header should be redacted');
    assert.ok(result.includes('[REDACTED:jwt]'));
  });

  it('should not redact base64 strings that are not JWTs', () => {
    // Fewer than 3 segments -- not a JWT
    const input = 'hash: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const result = redactSecrets(input);
    assert.equal(result, input);
  });
});

// ---------------------------------------------------------------------------
// redactSecrets -- OpenAI API keys
// ---------------------------------------------------------------------------

describe('redactSecrets - OpenAI API keys', () => {
  it('should redact an OpenAI API key', () => {
    const input = 'OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz1234';
    const result = redactSecrets(input);
    assert.ok(!result.includes('sk-abcdefghij'), 'key value should be removed');
    assert.ok(result.includes('[REDACTED:api-key]'));
  });

  it('should not redact short sk- strings (less than 20 chars after prefix)', () => {
    const input = 'sk-short';
    const result = redactSecrets(input);
    assert.equal(result, input);
  });
});

// ---------------------------------------------------------------------------
// redactSecrets -- GitHub tokens
// ---------------------------------------------------------------------------

describe('redactSecrets - GitHub tokens', () => {
  it('should redact a ghp_ token', () => {
    const input = 'GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz1234567890';
    const result = redactSecrets(input);
    assert.ok(!result.includes('ghp_abc'), 'token should be removed');
    assert.ok(result.includes('[REDACTED:github-token]'));
  });

  it('should redact a ghs_ token', () => {
    const input = 'token: ghs_abcdefghijklmnopqrstuvwxyz1234567890';
    const result = redactSecrets(input);
    assert.ok(result.includes('[REDACTED:github-token]'));
  });

  it('should not redact a ghp_ string shorter than 36 chars', () => {
    const input = 'ghp_short12345';
    const result = redactSecrets(input);
    assert.equal(result, input);
  });
});

// ---------------------------------------------------------------------------
// redactSecrets -- GitHub PATs
// ---------------------------------------------------------------------------

describe('redactSecrets - GitHub PATs', () => {
  it('should redact a github_pat_ token', () => {
    const input = 'PAT=github_pat_11ABCDEFGHIJKLMNOPQRSTUVWX_yz1234';
    const result = redactSecrets(input);
    assert.ok(result.includes('[REDACTED:github-pat]'));
    assert.ok(!result.includes('github_pat_11'));
  });

  it('should not redact a short github_pat_ string', () => {
    const input = 'github_pat_short';
    const result = redactSecrets(input);
    assert.equal(result, input);
  });
});

// ---------------------------------------------------------------------------
// redactSecrets -- AWS access keys
// ---------------------------------------------------------------------------

describe('redactSecrets - AWS access keys', () => {
  it('should redact an AWS access key ID', () => {
    const input = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
    const result = redactSecrets(input);
    assert.ok(result.includes('[REDACTED:aws-key]'));
    assert.ok(!result.includes('AKIAIOSFODNN7EXAMPLE'));
  });

  it('should not redact a string starting with AKIA but shorter than 20 chars', () => {
    const input = 'AKIA_SHORT';
    const result = redactSecrets(input);
    assert.equal(result, input);
  });
});

// ---------------------------------------------------------------------------
// redactSecrets -- Azure connection strings
// ---------------------------------------------------------------------------

describe('redactSecrets - Azure connection strings', () => {
  it('should redact an Azure storage AccountKey', () => {
    const input =
      'DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXRlc3Qh;EndpointSuffix=core.windows.net';
    const result = redactSecrets(input);
    assert.ok(result.includes('AccountKey=[REDACTED:azure-key]'));
    assert.ok(!result.includes('dGVzdGtleXRlc3Rr'));
  });
});

// ---------------------------------------------------------------------------
// redactSecrets -- generic credential fields
// ---------------------------------------------------------------------------

describe('redactSecrets - generic credential fields', () => {
  it('should redact password = value', () => {
    const input = 'password=supersecretvalue123';
    const result = redactSecrets(input);
    assert.ok(result.includes('[REDACTED:credential]'));
    assert.ok(!result.includes('supersecretvalue123'));
  });

  it('should redact secret: value in JSON-like text', () => {
    const input = '"secret": "my-secret-value-here"';
    const result = redactSecrets(input);
    assert.ok(result.includes('[REDACTED:credential]'));
  });

  it('should redact api_key=value', () => {
    const input = 'api_key=abcdefghijklmnop';
    const result = redactSecrets(input);
    assert.ok(result.includes('[REDACTED:credential]'));
  });

  it('should NOT redact "token" or "secret" alone without an assignment', () => {
    assert.equal(redactSecrets('the token was checked'), 'the token was checked');
    assert.equal(redactSecrets('keep it secret'), 'keep it secret');
  });

  it('should NOT redact short values (fewer than 8 chars)', () => {
    const input = 'password=short';
    const result = redactSecrets(input);
    assert.equal(result, input);
  });
});

// ---------------------------------------------------------------------------
// redactSecrets -- mixed content
// ---------------------------------------------------------------------------

describe('redactSecrets - mixed content', () => {
  it('should redact multiple patterns in a single string', () => {
    const input =
      'Authorization: Bearer tok123abc\n' +
      'OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz\n' +
      'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\n' +
      'user=admin';
    const result = redactSecrets(input);
    assert.ok(result.includes('[REDACTED:bearer]'), 'bearer redacted');
    assert.ok(result.includes('[REDACTED:api-key]'), 'api-key redacted');
    assert.ok(result.includes('[REDACTED:aws-key]'), 'aws-key redacted');
    assert.ok(result.includes('user=admin'), 'non-credential preserved');
  });
});

// ---------------------------------------------------------------------------
// redactSecrets -- idempotency
// ---------------------------------------------------------------------------

describe('redactSecrets - idempotency', () => {
  it('should produce the same result when applied twice', () => {
    const input = 'Authorization: Bearer eyABC123def456==\nsk-abcdefghijklmnopqrstu';
    const once = redactSecrets(input);
    const twice = redactSecrets(once);
    assert.equal(once, twice);
  });

  it('should be idempotent for clean input', () => {
    const input = 'git status --short';
    assert.equal(redactSecrets(input), input);
    assert.equal(redactSecrets(redactSecrets(input)), input);
  });
});

// ---------------------------------------------------------------------------
// redactSecrets -- edge cases
// ---------------------------------------------------------------------------

describe('redactSecrets - edge cases', () => {
  it('should return empty string unchanged', () => {
    assert.equal(redactSecrets(''), '');
  });

  it('should handle strings with only whitespace', () => {
    assert.equal(redactSecrets('   '), '   ');
  });

  it('should not throw on very long strings', () => {
    const long = 'A'.repeat(100_000);
    assert.doesNotThrow(() => redactSecrets(long));
  });
});
