// Cookieless, privacy-friendly analytics (Umami). It stores nothing on the
// visitor's device and collects no personal data, so no cookie banner is
// needed. It only loads when both VITE_UMAMI_* values are set, and it tracks
// page changes in this single-page app automatically.
export function loadAnalytics() {
  const src = import.meta.env.VITE_UMAMI_SRC as string | undefined
  const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined
  if (!src || !websiteId) return

  const script = document.createElement('script')
  script.defer = true
  script.src = src
  script.dataset.websiteId = websiteId
  // Never send query strings (e.g. password-reset tokens) to analytics.
  script.dataset.excludeSearch = 'true'
  document.head.appendChild(script)
}
