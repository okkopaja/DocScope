import type { PrismaClient } from '@docscope/db';
import type { GeminiEmbeddingClient } from '@docscope/embeddings';
import type { AskRequest, AskResponse, Citation } from '@docscope/shared-types';
import { createLogger } from '@docscope/shared-utils';
import { SearchEngine } from './search.js';
import { GoogleGenAI } from '@google/genai';

const log = createLogger('retrieval:ask');

const ANSWER_SYSTEM_PROMPT = `You are a precise document assistant. Answer the user's question based ONLY on the provided evidence documents.
Rules:
1. Ground every claim in a specific document
2. Include citations in the format [File: path, Page: N] or [File: path, Lines: N-M]
3. If the evidence doesn't contain the answer, say "I couldn't find this information in the indexed documents."
4. Be concise and factual
5. Never fabricate information`;

export class AskEngine {
  private readonly searchEngine: SearchEngine;
  private readonly ai: GoogleGenAI;

  constructor(
    db: PrismaClient,
    embeddingClient: GeminiEmbeddingClient,
    private readonly apiKey: string,
  ) {
    this.searchEngine = new SearchEngine(db, embeddingClient);
    this.ai = new GoogleGenAI({ apiKey });
  }

  async ask(request: AskRequest): Promise<AskResponse> {
    const start = Date.now();

    // 1. Retrieve top evidence chunks
    const searchResults = await this.searchEngine.search({
      query: request.question,
      workspaceId: request.workspaceId,
      type: request.type,
      top: request.top,
    });

    if (searchResults.length === 0) {
      return {
        answer: "I couldn't find any relevant documents in this workspace to answer your question.",
        citations: [],
        evidence: [],
        durationMs: Date.now() - start,
      };
    }

    // 2. Build evidence context
    const evidenceText = searchResults
      .map((r, i) => {
        const loc =
          r.pageNumber !== null
            ? `Page ${r.pageNumber}`
            : r.lineStart !== null
              ? `Lines ${r.lineStart}-${r.lineEnd}`
              : 'Full file';
        return `[Evidence ${i + 1}]\nFile: ${r.filePath}\nLocation: ${loc}\n---\n${r.snippet}`;
      })
      .join('\n\n');

    const prompt = `Evidence documents:\n\n${evidenceText}\n\n---\n\nQuestion: ${request.question}`;

    // 3. Call the answer model
    const answerModel = request.answerModel ?? 'gemini-2.5-flash';
    const response = await this.ai.models.generateContent({
      model: answerModel,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: ANSWER_SYSTEM_PROMPT,
        temperature: 0.1,
      },
    });

    const answer = response.text ?? '';

    // 4. Extract citations from used evidence
    const citations: Citation[] = searchResults.map((r) => ({
      filePath: r.filePath,
      snippet: r.snippet,
      pageNumber: r.pageNumber,
      lineStart: r.lineStart,
      lineEnd: r.lineEnd,
    }));

    const durationMs = Date.now() - start;
    log.info({ question: request.question, evidenceCount: searchResults.length, durationMs }, 'Ask complete');

    return {
      answer,
      citations,
      evidence: searchResults,
      durationMs,
    };
  }
}
