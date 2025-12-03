import { ChatOpenAI } from "@langchain/openai";
import { ConsoleCallbackHandler } from "langchain/callbacks";
import { CallbackManager } from "@langchain/core/callbacks/manager";
import { z } from "zod";
import { PromptTemplate } from "@langchain/core/prompts";
import dotenv from "dotenv";
dotenv.config();

const chat = new ChatOpenAI({
  temperature: 0.5,
  modelName: "google/gemini-2.5-flash-image-preview:free",
  openAIApiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
  streaming: true,
  maxRetries: 5,
  retryOnError: true,
  callbackManager: CallbackManager.fromHandlers({
    handleLLMNewToken: async (token) => {
      process.stdout.write(token);
    },
    handleLLMEnd: async () => {
      console.log("\n\nStream ended");
    },
  }),
});

const getWeather = (city) => {
  const API_KEY = "1e4239cb2094a9b36d2558ac2dff9912"; // Replace with your actual API key
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric`;

  return fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error("City not found or API error");
      }
      return response.json();
    })
    .then((data) => {
        console.log("Weather Data:", data);
      const weather = data.weather[0].description;
      const temp = data.main.temp;
      return `The weather in ${city} is ${weather} with a temperature of ${temp}°C.`;
    })
    .catch((error) => {
      return `Error: ${error.message}`;
    });
};

const weatherToolParams = {
  name: "get_weather",
  description:
    "Use this tool to get the current weather of a city. Input should be a city name.",
  schema: z.object({
    city: z.string().describe("Name of the city"),
  }),
  func: async (input) => {
    return await getWeather(input.city);
  },
};

const tools = [weatherToolParams];

const question = "What is the current weather in Delhi?";

// Create a PromptTemplate using dynamic insertion for tools
const prompt = PromptTemplate.fromTemplate(`
You are a helpful assistant that helps users find information.
You have access to the following tools:

${tools.map(tool => `${tool.name}: ${tool.description}`).join("\n")}

Use the following format:

Question: ${question}
Thought: Do I need to use a tool? Yes
Action: the action to take, should be one of [${tools.map(tool => tool.name).join(", ")}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: Do I need to use a tool? No
Final Answer: the final answer to the original question.

**Note:** Please answer in **English**.

Begin!

Question: ${question}
Thought: {agent_scratchpad}
Final Answer:
`);
console.log("Prompt:", prompt);
const formattedPrompt = prompt.format({
  tools: tools
    .map((tool) => `${tool.name}: ${tool.description}`)
    .join("\n"),
  tool_names: tools.map((tool) => tool.name).join(", "),
  question: question,
  agent_scratchpad: "",   
});
const response = await chat.call([
  {
    role: "user",
    content: [formattedPrompt].join("\n"),
  },
]);
console.log("\n\nFinal Response:", response.text);
