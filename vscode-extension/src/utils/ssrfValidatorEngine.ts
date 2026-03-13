import {
 addAllowedHostInternal,
 ALLOWED_SCHEMES,
 BLOCKED_METADATA_HOSTS,
 getAllowedHostsSnapshot,
 isAllowedHost,
 lookupAddress,
 PRIVATE_IPV4_PATTERNS,
 PRIVATE_IPV6_PATTERNS,
 removeAllowedHostInternal,
} from './ssrfValidatorInternals';
import type { SsrfValidationResult } from './ssrfValidatorTypes';

export function addAllowedHost(hostname: string): void {
 addAllowedHostInternal(hostname);
}

export function removeAllowedHost(hostname: string): boolean {
 return removeAllowedHostInternal(hostname);
}

export function getAllowedHosts(): ReadonlySet<string> {
 return getAllowedHostsSnapshot();
}

export function isPrivateIp(ip: string): boolean {
 if (!ip) {
  return false;
 }

 const normalized = ip.trim();
 const ipv4Mapped = normalized.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
 if (ipv4Mapped) {
  return isPrivateIp(ipv4Mapped[1]);
 }

 if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
  return PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(normalized));
 }

 return PRIVATE_IPV6_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function validateUrl(rawUrl: string): SsrfValidationResult {
 if (!rawUrl || rawUrl.trim() === '') {
  return { allowed: false, url: rawUrl, reason: 'Empty URL' };
 }

 let parsed: URL;
 try {
  parsed = new URL(rawUrl);
 } catch {
  return { allowed: false, url: rawUrl, reason: 'Invalid URL: could not be parsed' };
 }

 const url = parsed.toString();
 const hostname = parsed.hostname.toLowerCase();

 if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
  return {
   allowed: false,
   url,
   reason: `Scheme "${parsed.protocol}" is not allowed; only http: and https: are permitted`,
  };
 }

 if (isAllowedHost(hostname)) {
  return { allowed: true, url };
 }

 if (BLOCKED_METADATA_HOSTS.has(hostname)) {
  return {
   allowed: false,
   url,
   reason: `Hostname "${hostname}" is a blocked cloud metadata endpoint`,
  };
 }

 if (isPrivateIp(hostname)) {
  return {
   allowed: false,
   url,
   reason: `Hostname "${hostname}" resolves to a private/loopback IP address`,
  };
 }

 return { allowed: true, url };
}

export async function resolveAndValidate(rawUrl: string): Promise<SsrfValidationResult> {
 const staticResult = validateUrl(rawUrl);
 if (!staticResult.allowed) {
  return staticResult;
 }

 let parsed: URL;
 try {
  parsed = new URL(rawUrl);
 } catch {
  return { allowed: false, url: rawUrl, reason: 'Invalid URL: could not be parsed' };
 }

 const hostname = parsed.hostname.toLowerCase();
 if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) || hostname.includes(':')) {
  return staticResult;
 }

 const address = await lookupAddress(hostname);
 if (address) {
  if (isPrivateIp(address)) {
   return {
    allowed: false,
    url: staticResult.url,
    reason: `Hostname "${hostname}" resolves to private IP "${address}" (DNS rebinding attack)`,
   };
  }
  if (BLOCKED_METADATA_HOSTS.has(address)) {
   return {
    allowed: false,
    url: staticResult.url,
    reason: `Hostname "${hostname}" resolves to blocked metadata IP "${address}"`,
   };
  }
 }

 return staticResult;
}

export function validateToolUrlParams(params: Record<string, unknown>): SsrfValidationResult {
 const urlParamNames = ['url', 'endpoint', 'baseUrl', 'targetUrl', 'apiUrl', 'webhookUrl'];

 for (const paramName of urlParamNames) {
  const value = params[paramName];
  if (typeof value === 'string' && value.trim() !== '') {
   const result = validateUrl(value);
   if (!result.allowed) {
    return { ...result, reason: `[param: ${paramName}] ${result.reason ?? 'Blocked by SSRF policy'}` };
   }
  }
 }

 return { allowed: true, url: '' };
}