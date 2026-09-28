import type { ReactNode } from 'react'
import { ArrowLeft, GraduationCap } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { PageMeta } from '@/components/PageMeta'
import { SiteFooterLinks } from '@/components/SiteFooterLinks'
import { SITE } from '@/config/site'

// Readable single-column layout for the Privacy Policy and Terms pages.
// Public: works whether or not the visitor is logged in.
export function LegalLayout({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  const navigate = useNavigate()

  return (
    <div className="min-h-svh bg-muted">
      <PageMeta title={title} description={description} />
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="size-4" />
            </span>
            {SITE.name}
          </Link>
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            className="-mr-2 flex min-h-9 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <article className="rounded-xl border bg-background p-6 text-sm leading-relaxed sm:p-8 [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">Last updated: {SITE.legalLastUpdated}</p>
          {children}
        </article>
        <SiteFooterLinks className="mt-6 justify-center" />
      </main>
    </div>
  )
}
