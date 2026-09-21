import type { CartLine, DesignDraft } from '../api/customer';

export const emptyDesign = (quantity: number): DesignDraft => ({ quantity, brief: '' });

export function designError(quantity: number, designs: DesignDraft[]): string {
  if (!designs.length) return 'Add artwork or a design brief for this item.';
  if (designs.some(d => !Number.isInteger(d.quantity) || d.quantity < 1) || designs.reduce((n, d) => n + d.quantity, 0) !== quantity)
    return 'The quantities assigned to designs must match the item quantity.';
  if (designs.some(d => d.upload_name && !d.file)) return 'Please reattach the saved design file before continuing.';
  if (designs.some(d => !d.file && !d.brief.trim())) return 'Upload a file or add a brief for every design.';
  return '';
}

export function attachmentError(lines: CartLine[]): string {
  const files = lines.flatMap(line => (line.designs ?? []).flatMap(d => d.file ? [d.file] : []));
  if (files.length > 30 || files.reduce((sum, f) => sum + f.size, 0) > 20 * 1024 * 1024)
    return 'Use at most 30 design files, with a combined size of 20 MB or less.';
  return '';
}

export function resizeDesigns(designs: DesignDraft[] | undefined, quantity: number): DesignDraft[] {
  const current = designs?.length ? designs : [emptyDesign(quantity)];
  // A shared design automatically follows the item quantity; split designs need explicit allocation.
  return current.length === 1 ? [{ ...current[0], quantity }] : current;
}
