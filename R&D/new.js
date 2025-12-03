import { ChatOllama } from "@langchain/ollama";
import { tool } from "@langchain/core/tools";
import * as z from "zod";

// Create tools
const weatherTool = tool(
  async ({ location }) => {
    return `The current weather in ${location} is 20°C with clear skies.`;
  },
  {
    name: "get_current_weather",
    description: "Get the current weather in a given location",
    schema: z.object({
      location: z.string(),
    }),
  }
);

const addTool = tool(
  async ({ a, b }) => a + b,
  {
    name: "add_two_numbers",
    description: "Add two numbers",
    schema: z.object({
      a: z.number(),
      b: z.number(),
    }),
  }
);

// Create LLM
const llm = new ChatOllama({
  model: "qwen3:0.6b",
  think: false,
  streaming: true,
});

// Bind tools
const llmWithTools = llm.bindTools([weatherTool, addTool]);

// STEP 1 — ask a question
const firstResponse = await llmWithTools.invoke([
  { role: "system", content: "You are a helpful assistant that uses tools." },
  { role: "user", content: "What's the weather in New York? Also what is 15 + 27?" },
]);

console.log("\n---- FIRST RESPONSE ----");
console.log(firstResponse);

// Prepare next messages array
const messages = [
  { role: "system", content: "You are a helpful assistant that uses tools." },
  { role: "user", content: "What's the weather in New York? Also what is 15 + 27?" },
];

// STEP 2 — Execute tools
for (const call of firstResponse.tool_calls ?? []) {
  let toolResult;

  if (call.name === "get_current_weather") {
    toolResult = await weatherTool.func(call.args);
  }

  if (call.name === "add_two_numbers") {
    toolResult = await addTool.func(call.args);
  }

  // Push tool result
  messages.push({
    role: "tool",
    tool_call_id: call.id,
    content: String(toolResult),
  });
}

// STEP 3 — Final answer
const finalResponse = await llmWithTools.invoke(messages);

console.log("\n---- FINAL ANSWER ----");
console.log(finalResponse.content);
