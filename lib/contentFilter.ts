/** Conservative client-side blocklist — word-boundary match; clear abuse only. */
const OBJECTIONABLE_RE =
  /\b(nigger|faggot|retard(?:ed)?|kill yourself|kys|child porn|csam|rape you)\b/i;

export function containsObjectionableContent(text: string | null | undefined): boolean {
  if (!text) return false;
  return OBJECTIONABLE_RE.test(text);
}

export function assertListingTextClean(fields: {
  title?: string;
  notes?: string;
  pickup_address?: string;
}): string | null {
  for (const [key, value] of Object.entries(fields)) {
    if (containsObjectionableContent(value)) {
      return `Please revise ${key.replace("_", " ")} — prohibited language is not allowed.`;
    }
  }
  return null;
}
