// One place for public site details. Edit these before going live.
// Only PUBLIC values belong in the frontend: anything here ships to every
// visitor's browser, so never put secrets (API keys, passwords) in this file
// or in VITE_* variables.
export const SITE = {
  name: 'AdaptiveLearn',
  tagline: 'AI-powered smart classroom and personalised learning platform',
  description:
    // Kept under ~155 characters so search engines don't cut it off.
    'AI-powered smart classroom with personalised learning, plus dedicated portals for students, instructors, parents and administrators.',
  // TODO: replace with the real contact / grievance email before launch.
  contactEmail: 'pimpalkarmukesh07@gmail.com',
  // TODO: replace with the legal name of the organisation running the site.
  organisation: 'AdaptiveLearn',
  // Last time the Privacy Policy / Terms text changed.
  legalLastUpdated: '28 September 2026',
  url: (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') ?? window.location.origin,
} as const
