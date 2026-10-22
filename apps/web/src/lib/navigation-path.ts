/**
 * Compare navigation paths at a segment boundary. String-typed inputs are
 * intentional: NAV_ITEMS is an 'as const' tuple containing no "/" item,
 * so an inline comparison of item.href against "/" triggers TS2367.
 *
 * Preserve exact root matching in case a root item is reintroduced later.
 */
export function isNavigationPathActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}
