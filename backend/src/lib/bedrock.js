import "dotenv/config";
import { BedrockRuntimeClient, ConverseCommand, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { config } from "../config.js";

const bedrock = new BedrockRuntimeClient({ region: config.bedrock.region });

export async function createEmbedding(text) {
  const command = new InvokeModelCommand({
    modelId: config.bedrock.embedModelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      inputText: text
    })
  });

  const response = await bedrock.send(command);
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

  const response = await bedrock.send(command);
  const textBlocks = response.output?.message?.content?.flatMap((item) => ("text" in item ? [item.text] : [])) ?? [];
  return textBlocks.join("\n").trim();
}
