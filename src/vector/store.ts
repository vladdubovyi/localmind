/** Vector stub — keyword memory owns ship path. No-op so UI never throws. */
export interface VectorRecord {
  id: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}
export class VectorStore {
  async upsert(_records: VectorRecord[]): Promise<void> {}
  async search(_queryEmbedding: number[], _k = 5): Promise<VectorRecord[]> { return []; }
}
