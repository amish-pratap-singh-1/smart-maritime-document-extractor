import { pdf } from 'pdf-to-img';

/**
 * Convert a PDF buffer to an array of PNG image buffers (one per page).
 * For the LLM, we typically only need the first page or a few pages.
 */
export async function pdfToImages(pdfBuffer: Buffer): Promise<Buffer[]> {
  const images: Buffer[] = [];

  const document = await pdf(pdfBuffer, { scale: 2 });
  for await (const page of document) {
    images.push(Buffer.from(page));
  }

  return images;
}

/**
 * Convert a PDF to a single image (first page only).
 * This is the common case for maritime certificates — single-page docs.
 */
export async function pdfToFirstImage(pdfBuffer: Buffer): Promise<Buffer> {
  const document = await pdf(pdfBuffer, { scale: 2 });

  for await (const page of document) {
    return Buffer.from(page);
  }

  throw new Error('PDF has no pages');
}
