/** What the bundle label barcode carries: the order item id, prefixed so a scan is never mistaken for anything else. */
export const itemCode = (itemId: number) => `JOB-${itemId}`;
export const parseItemCode = (code: string) => {
  const m = code.trim().match(/^JOB-?(\d{1,9})$/i);
  return m ? Number(m[1]) : null;
};
