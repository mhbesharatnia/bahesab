/** Human-readable transfer path for RTL UI (avoids mirrored → confusion). */
export function formatTransferPath(fromName: string, toName: string): string {
  return `از ${fromName} به ${toName}`
}
