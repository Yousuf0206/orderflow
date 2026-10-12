import { Link } from "react-router-dom";

import { isNative, openExternal, WEBSITE_ORIGIN } from "../platform";

/**
 * Link to /privacy or /terms. In the app the legal pages open in an in-app
 * browser sheet over the live website (spec 007 R6); on the web it is a
 * normal route.
 */
export default function LegalLink({
  to,
  className,
  children,
}: {
  to: "/privacy" | "/terms";
  className?: string;
  children: React.ReactNode;
}) {
  if (isNative()) {
    return (
      <a
        href={`${WEBSITE_ORIGIN}${to}`}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          void openExternal(`${WEBSITE_ORIGIN}${to}`);
        }}
      >
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}
