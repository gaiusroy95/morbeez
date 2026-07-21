/** Button / list reply from WhatsApp interactive messages — prefer stable ids (e.g. lang.en). */
export function extractInteractiveReplyText(
  interactive: Record<string, unknown> | undefined
): string | null {
  if (!interactive) return null;
  const btn = interactive.button_reply as Record<string, string> | undefined;
  const list = interactive.list_reply as Record<string, string> | undefined;
  const id = btn?.id ?? list?.id;
  if (id?.trim()) return id.trim();
  const title = btn?.title ?? list?.title;
  return title?.trim() ? title.trim() : null;
}
