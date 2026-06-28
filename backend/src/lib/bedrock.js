import "dotenv/config";
import { BedrockRuntimeClient, ConverseCommand, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { config } from "../config.js";

const bedrock = new BedrockRuntimeClient({ region: config.bedrock.region });
const AWS_CALL_TIMEOUT_MS = 20_000;

async function sendBedrock(command, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AWS_CALL_TIMEOUT_MS);

  try {
    return await bedrock.send(command, { abortSignal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`${label} timed out after ${AWS_CALL_TIMEOUT_MS / 1000} seconds`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createEmbedding(text) {
  const command = new InvokeModelCommand({
    modelId: config.bedrock.embedModelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      inputText: text
    })
  });

  const response = await sendBedrock(command, "Bedrock embedding");
  const payload = JSON.parse(new TextDecoder().decode(response.body));
  return payload.embedding;
}

export async function answerWithContext({ systemPrompt, question, contexts }) {
  const command = new ConverseCommand({
    modelId: config.bedrock.chatModelId,
    system: [{ text: systemPrompt }],
    inferenceConfig: {
      maxTokens: 400,
      temperature: 0.2
    },
    messages: [
      {
        role: "user",
        content: [
          {
            text: [
              "Answer the question using the provided context only when it is relevant.",
              "If the context is insufficient, say that the uploaded documents do not contain enough information.",
              "",
              `Question: ${question}`,
              "",
              "Context:",
              contexts
                .slice(0, 2)
                .map((item, index) => `[${index + 1}] ${item.slice(0, 1200)}`)
                .join("\n\n")
            ].join("\n")
          }
        ]
      }
    ]
  });

  const response = await sendBedrock(command, "Bedrock chat");
  const textBlocks = response.output?.message?.content?.flatMap((item) => ("text" in item ? [item.text] : [])) ?? [];
  return textBlocks.join("\n").trim();
}
