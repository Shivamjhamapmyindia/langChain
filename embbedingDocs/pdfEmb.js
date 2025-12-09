import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { OllamaEmbeddings } from "@langchain/ollama";
import { ChromaClient } from "chromadb";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const __dirname = dirname(fileURLToPath(import.meta.url));

// const pdfPath = join(__dirname, "docs/abc_travel_agency_brochure.pdf");
const pdfPath = join(__dirname, "docs/test.pdf");
const chromaStorePath = join(
  __dirname,
  "..",      // go up 1 level (exit embbedingDocs)
  "chromaDb",
  "chroma-store"
);
console.log(chromaStorePath);



// Load PDF as text buffer
const pdfBuffer = fs.readFileSync(pdfPath, "utf8"); // ensure utf8

console.log("✂️ Splitting PDF...");

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
});

const chunks = await splitter.splitText(pdfBuffer);

  // ⭐ FIX: Clean metadata (Chroma accepts only strings/numbers/bools)
//   const cleanedDocs = chunks.map((d, i) => 
//   //   {
//   //   console.log("Chunk", i, "content:", d);
//   // }
//     ({
    
//     ...d,
//     metadata: {
//       id: i,                              // required unique metadata
//       source: "pdf",
//       page: d.metadata?.page || 0,
//     }
//   })
// );
//----------------------------------------------------------
// Embeddings
//----------------------------------------------------------
const embedder = new OllamaEmbeddings({
  model: "mxbai-embed-large:latest",
});

//----------------------------------------------------------
// Init Chroma
//----------------------------------------------------------
const chroma = new ChromaClient({
  // path: chromaStorePath,   // LOCAL persistent storage
  host: "localhost", port: 8000
});

// Create / load collection
const collection = await chroma.getOrCreateCollection({
  name: "test",//abc_travel_agency_brochure//test
  embeddingFunction: null,   // because we embed manually
});

//----------------------------------------------------------
// Process chunks → generate embeddings → store
//----------------------------------------------------------
console.log("🧠 Creating embeddings...");

for (let i = 0; i < chunks.length; i++) {
  const text = chunks[i];
  const id = uuidv4();

  const embedding = await embedder.embedQuery(text);

  await collection.add({
    ids: [id],
    embeddings: [embedding],
    metadatas: [{ page: i }],
    documents: [text],
  });

  console.log(`Stored chunk ${i + 1}/${chunks.length}`);
}

console.log("✅ Finished! Vector DB saved at:", chromaStorePath);


  // const collections = await chroma.listCollections();
  // collections.forEach((col, i) => {
  //   console.log(`${i + 1}. Name: ${col.name}`);
  // });

 