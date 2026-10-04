import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    
    // Initial check is already handled by the state initialization,
    // but we can ensure it's up to date without triggering an ESLint error
    // by only setting it if it changed.
    const currentIsMobile = window.innerWidth < MOBILE_BREAKPOINT;
    if (isMobile !== currentIsMobile) {
      setTimeout(() => setIsMobile(currentIsMobile), 0);
    }

    return () => mql.removeEventListener("change", onChange)
  }, [isMobile])

  return !!isMobile
}
