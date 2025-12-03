
// Function to interact with Ollama model and handle the response as a stream
async function queryOllama(query) {
  try {
    const response = await axios.post(ollamaAPI, {
      model: "qwen3:0.6b",
      prompt: query,  // Customize this depending on Ollama's API structure
    }, {
      responseType: 'stream' // This enables stream mode
    });

    // Handle the stream data
    response.data.on('data', (chunk) => {
      console.log('Received chunk:', chunk.toString());
    });

    response.data.on('end', () => {
      console.log('Stream ended');
    });

    response.data.on('error', (err) => {
      console.error('Stream error:', err);
    });

  } catch (error) {
    console.error('Error interacting with Ollama API:', error);
  }
}

// Example query to Ollama
// queryOllama("Hello, Ollama!").then(response => {
//   console.log("Ollama Response (stream):", response);
// });


import { ChatOllama } from '@langchain/ollama';
import { tool } from "@langchain/core/tools";
import * as z from "zod";

// const data=[
//     {
//         city: "San Francisco",
//         temperature: "15°C",
//         condition: "Partly Cloudy",
//         forecast: [
//             { day: "Today", temperature: "16°C", condition: "Sunny" },
//             { day: "Tomorrow", temperature: "17°C", condition: "Partly Cloudy" },
//         ],
//     },
//     {
//         city: "New York",
//         temperature: "20°C",
//         condition: "Sunny",
//         forecast: [
//             { day: "Today", temperature: "21°C", condition: "Sunny" },
//             { day: "Tomorrow", temperature: "22°C", condition: "Partly Cloudy" },
//         ],
//     },
//     {
//         city: "Los Angeles",
//         temperature: "25°C",
//         condition: "Sunny",
//         forecast: [
//             { day: "Today", temperature: "26°C", condition: "Sunny" },
//             { day: "Tomorrow", temperature: "27°C", condition: "Partly Cloudy" },
//         ],  
    
//     },{
//         city: "Chicago",
//         temperature: "10°C",
//         condition: "Cloudy",
//         forecast: [
//             { day: "Today", temperature: "11°C", condition: "Cloudy" },
//             { day: "Tomorrow", temperature: "12°C", condition: "Rain" },
//         ],
//     }];

const llm = new ChatOllama({
    // baseUrl: "http://10.10.21.108:11434/api/generate",
    model: "qwen3:0.6b",
    // temperature: 0,
    // maxRetries: 2,
    think: false,
    streaming: true,
})




const weatherTool = tool( async (location) => {
  return `The current weather in ${location} is 20°C with clear skies.`;
}, {
  name: "get_current_weather",
  description: "Get the current weather in a given location",
  schema: z.object({
    location: z.string().describe("The city and state, e.g. San Francisco, CA"),
  })
}
);



// 1️⃣ Define a simple addition tool
const addTool = tool(
  async ({ a, b }) => {
    return a + b;
  },
  {
    name: "add_two_numbers",
    description: "Adds two numbers and returns the result.",
    schema: {
      type: "object",
      properties: {
        a: { type: "number" },
        b: { type: "number" }
      },
      required: ["a", "b"]
    }
  }
);


const llmWithTools = llm.bindTools([weatherTool, addTool]);

const response = await llmWithTools.invoke([
  [
    "system",
    "You are a helpful assistant that can use tools to get information.",
  ],
  [
    "human",
    "What's the current weather in New York? Also, what's 15 plus 27?",
  ],
]);

console.log(response);

// const aiMsg =await llm.invoke([
//     [
//         "system",
//         "You are a helpful assistant that translates English to French. Translate the user sentence.",
//     ],
//     ["human", "I love programming."],
// ])
// // console.log(aiMsg);
// console.log(aiMsg.content)

//working code 

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
