import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function normalizeHref(href?: string): string {
  if (!href) return '#';
  const value = href.trim();
  if (!value) return '#';
  if (
    value.startsWith('https://') ||
    value.startsWith('http://') ||
    value.startsWith('mailto:') ||
    value.startsWith('tel:') ||
    value.startsWith('#')
  ) {
    return value;
  }
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('www.')) return `https://${value}`;
  const domainPattern = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+([/?#].*)?$/;
  if (domainPattern.test(value)) return `https://${value}`;
  if (value.startsWith('/')) return value;
  return '#';
}

export default function OjaMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ children: linkChildren, href, ...props }) => {
          const safeHref = normalizeHref(href);
          return (
            <a
              {...props}
              href={safeHref}
              target="_blank"
              rel="noopener noreferrer"
              className="ojachat-link"
              title={safeHref}
            >
              {linkChildren}
            </a>
          );
        }
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
