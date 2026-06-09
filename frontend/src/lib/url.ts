/**
 * Allow only http(s) URLs for externally-sourced hrefs (TMDB homepage,
 * review URLs, JustWatch links). React doesn't block `javascript:` or
 * `data:` schemes in `href`, so a poisoned upstream value could otherwise
 * become a clickable script URL.
 */
export function safeExternalUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  return /^https?:\/\//i.test(url) ? url : undefined
}
