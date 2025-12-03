import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OllamaEmbeddings, ChatOllama } from "@langchain/ollama";

async function askQuestion(question) {
  console.log("🔍 Loading vector DB...");
  const vectorStore = await Chroma.fromExistingCollection(
    new OllamaEmbeddings({ model: "mxbai-embed-large:latest" }),
    {
      collectionName: "pdf_rag",
      path: "./chroma_store",
    }
  );


  const retriever = vectorStore.asRetriever();
  const docs = await retriever.invoke(question);
  
  const contextText = docs.map(d => d.pageContent).join("\n");
// console.log(contextText);
//   return;
  const prompt = `
Use the following context to answer the question.

CONTEXT:
${contextText}

QUESTION: ${question}
  `;

  const model = new ChatOllama({ model: "qwen3:0.6b" ,think:false});
const answer = await model.invoke(prompt);

  console.log("\n🟩 Final Answer:");
  console.log(answer);
}

// askQuestion("What does the PDF say about the main topic?");
askQuestion("How to contact agency?");