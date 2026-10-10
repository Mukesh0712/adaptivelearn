import type { ComponentProps } from 'react'
import ReactMarkdown, { type Components, type ExtraProps } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// react-markdown passes each element its syntax-tree `node`; it must not
// reach the DOM, so `shift` drops it before rendering the lower heading.
const shift =
  (Tag: 'h2' | 'h3' | 'h4' | 'h5' | 'h6') =>
  ({ node, ...props }: ComponentProps<'h1'> & ExtraProps) => {
    void node
    return <Tag {...props} />
  }

// Headings are moved one level down: the lesson title on the page is the
// <h1>, so a "# Heading" in the lesson text becomes an <h2>, and so on.
// That keeps one <h1> per page for screen-reader users.
const components: Components = {
  h1: shift('h2'),
  h2: shift('h3'),
  h3: shift('h4'),
  h4: shift('h5'),
  h5: shift('h6'),
  // Links leave AdaptiveLearn in a new tab. rel="noopener noreferrer"
  // stops the other site from controlling this tab through window.opener.
  a: ({ node, href, children, ...props }) => {
    void node
    const external = !!href && /^https?:\/\//i.test(href)
    return (
      <a href={href} {...props} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {children}
        {external && <span className="sr-only"> (opens in a new tab)</span>}
      </a>
    )
  },
  // Images from other websites are blocked by the Content Security Policy
  // (so lesson text can't load trackers). Show a link to the image instead.
  img: ({ src, alt }) =>
    typeof src === 'string' && /^https?:\/\//i.test(src) ? (
      <a href={src} target="_blank" rel="noopener noreferrer">
        Image: {alt || 'open image'}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    ) : null,
  // Wide tables scroll sideways instead of stretching the page on phones.
  table: ({ node, ...props }) => {
    void node
    return (
      <div className="overflow-x-auto">
        <table {...props} />
      </div>
    )
  },
}

// Shows lesson text written in Markdown. Safe for text typed by anyone:
// react-markdown builds React elements and never runs raw HTML, and it
// drops dangerous link targets such as "javascript:".
// remark-gfm adds tables, ~~strikethrough~~, task lists and bare URLs.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="lesson-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
