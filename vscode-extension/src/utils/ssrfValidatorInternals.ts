import * as dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

export const ALLOWED_SCHEMES: readonly string[] = ['http:', 'https:'];

export const BLOCKED_METADATA_HOSTS: ReadonlySet<string> = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  '100.100.100.200',
  'fd00:ec2::254',
]);

export const PRIVATE_IPV4_PATTERNS: readonly RegExp[] = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^169\.254\.\d{1,3}\.\d{1,3}$/,
  /^0\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
];

export const PRIVATE_IPV6_PATTERNS: readonly RegExp[] = [
  /^::1$/i,
  /^f[cd][0-9a-f]{2}:/i,
  /^fe[89ab][0-9a-f]:/i,
];

const INTERNAL_ALLOWLIST: Set<string> = new Set();

export function addAllowedHostInternal(hostname: string): void {
  INTERNAL_ALLOWLIST.add(hostname.toLowerCase());
}

export function removeAllowedHostInternal(hostname: string): boolean {
  return INTERNAL_ALLOWLIST.delete(hostname.toLowerCase());
}

export function getAllowedHostsSnapshot(): ReadonlySet<string> {
  return new Set(INTERNAL_ALLOWLIST);
}

export function isAllowedHost(hostname: string): boolean {
  return INTERNAL_ALLOWLIST.has(hostname.toLowerCase());
}

export async function lookupAddress(hostname: string): Promise<string | undefined> {
  try {
    const { address } = await dnsLookup(hostname);
    return address;
  } catch {
    return undefined;
  }
}
