/**
 * Local vector index stub — Milestone 4.
 * Planned backend: MiniSearch or LanceDB WASM over IndexedDB.
 */
export interface VectorRecord {
  id: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

export class VectorStore {
  async upsert(_records: VectorRecord[]): Promise<void> {
    throw new Error('Vector store lands in Milestone 4.');
  }

  async search(_queryEmbedding: number[], _k = 5): Promise<VectorRecord[]> {
    throw new Error('Vector store lands in Milestone 4.');
  }
}
