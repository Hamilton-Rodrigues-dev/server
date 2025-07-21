import { GoogleGenAI } from "@google/genai";
import { env } from "../env.ts";

import { eq } from "drizzle-orm";
import { db } from "../db/connection.ts";
import { audioChunks } from "../db/schema/audio-chunks.ts";

const gemini = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
});

const model = "gemini-2.5-flash";

/**
 * Transcreve áudio base64 para texto usando Gemini.
 *
 * @param audioAsBase64 áudio em base64, recebido do frontend
 * @param mimeType tipo MIME do áudio, ex: "audio/wav"
 */
export async function transcribeAudio(audioAsBase64: string, mimeType: string) {
  try {
    if (!audioAsBase64 || !mimeType) {
      throw new Error("Áudio base64 ou mimeType não informado");
    }

    // Debug: log do tamanho dos dados recebidos
    console.log(
      `Transcrevendo áudio com tamanho base64: ${audioAsBase64.length}, MIME: ${mimeType}`
    );

    const response = await gemini.models.generateContent({
      model,
      contents: [
        {
          text:
            "Transcreva o áudio para português do Brasil. " +
            "Seja preciso e natural na transcrição. " +
            "Mantenha a pontuação adequada e divida o texto em parágrafos quando for apropriado.",
        },
        {
          inlineData: {
            mimeType,
            data: audioAsBase64,
          },
        },
      ],
    });

    if (!response.text) {
      throw new Error("Resposta do Gemini vazia");
    }

    return response.text;
  } catch (error: any) {
    console.error("Erro ao transcrever áudio:", error);
    throw new Error("Não foi possível converter o áudio");
  }
}

/**
 * Gera embeddings para texto.
 */
export async function generateEmbeddings(text: string) {
  try {
    const response = await gemini.models.embedContent({
      model: "text-embedding-004",
      contents: [{ text }],
      config: {
        taskType: "RETRIEVAL_DOCUMENT",
      },
    });

    if (!response.embeddings?.[0].values) {
      throw new Error("Não foi possível gerar os embeddings.");
    }

    return response.embeddings[0].values;
  } catch (error: any) {
    console.error("Erro ao gerar embeddings:", error);
    throw error;
  }
}

/**
 * Busca todas as transcrições dos chunks do banco, filtrando pelo roomId.
 */
async function getAllAudioTranscriptions(roomId: string): Promise<string[]> {
  const rows = await db
    .select({ transcription: audioChunks.transcription })
    .from(audioChunks)
    .where(eq(audioChunks.roomId, roomId))
    .orderBy(audioChunks.createdAt);

  return rows.map((r) => r.transcription);
}

// Gera resposta recebendo sempre o UUID da sala em roomId
export async function generateAnswer(question: string, roomId: string) {
  if (!roomId || typeof roomId !== "string") {
    throw new Error("Parâmetro 'roomId' inválido ou ausente");
  }

  // Busca as transcrições para essa sala
  const transcriptions = await getAllAudioTranscriptions(roomId);

  if (transcriptions.length === 0) {
    throw new Error(
      "Não há chunks de áudio disponíveis no banco para responder."
    );
  }

  const context = transcriptions.join("\n\n");

  const prompt = `
    Com base no texto fornecido abaixo como contexto, responda a pergunta de forma clara e precisa em português do Brasil.

    CONTEXTO:
    ${context}

    PERGUNTA:
    ${question}

    INSTRUÇÕES:
    - Use apenas informações contidas no contexto enviado;
    - Se a resposta não for encontrada no contexto, apenas responda que não possui informações suficientes para responder;
    - Seja objetivo;
    - Mantenha um tom educativo e profissional;
    - Cite trechos relevantes do contexto se apropriado;
    - Se for citar o contexto, utilize o termo "conteúdo da aula";
  `.trim();

  try {
    const response = await gemini.models.generateContent({
      model,
      contents: [{ text: prompt }],
    });

    if (!response.text) {
      throw new Error("Resposta do Gemini vazia");
    }
    return response.text;
  } catch (error: any) {
    console.error("Erro ao gerar resposta:", error);
    throw new Error("Falha ao gerar resposta pelo Gemini");
  }
}
