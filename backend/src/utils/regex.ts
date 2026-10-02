// Escapes regex special characters so user search text like "a.b" or "(x"
// matches literally instead of being run as a pattern (also prevents a
// crafted search from making MongoDB run a very slow regex).
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
