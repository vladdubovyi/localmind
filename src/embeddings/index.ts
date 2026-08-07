/** Embeddings stub — keyword memory does not use this. Empty vectors keep UI paths safe. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  return texts.map(() => []);
}
