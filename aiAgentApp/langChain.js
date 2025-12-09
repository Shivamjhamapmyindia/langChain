import { ChatOllama,OllamaEmbeddings } from "@langchain/ollama";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { weatherTool, addTool } from "./tools.js"; // Correct import here

// Create LLM
const llm = new ChatOllama({
  model: "qwen3:0.6b",
  streaming: true,
  think: false,
});

const llmWithTools = llm.bindTools([weatherTool, addTool]);

const queryOnPdf = async (question) => {
  const vectorStore = await Chroma.fromExistingCollection(
    new OllamaEmbeddings({ model: "mxbai-embed-large:latest" }),
    {
      collectionName: "abc_travel_agency_brochure",
      path: "./chroma_store",
    }
  );

  const retriever = vectorStore.asRetriever();
  const docs = await retriever.invoke(question);

  const contextText = docs.map((d) => d.pageContent).join("\n");
  // console.log(contextText);
  //   return;
  const prompt = `
Use the following context to answer the question.

CONTEXT:
${contextText}

QUESTION: ${question}
  `;

  const model = new ChatOllama({ model: "qwen3:0.6b", think: false });
  const answer = await model.invoke(prompt);

  console.log("\n🟩 Final Answer:");
  console.log(answer);
};
// queryOnPdf("What services does ABC Travel Agency offer?");

export { llmWithTools };
