import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OllamaEmbeddings } from "@langchain/ollama";

async function ingestPDF() {
  console.log("📥 Loading PDF...");
  const loader = new PDFLoader("./abc_travel_agency_brochure.pdf");
  const docs = await loader.load();

  console.log("✂️ Splitting PDF...");
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 150,
  });

  const splitDocs = await splitter.splitDocuments(docs);

  // ⭐ FIX: Clean metadata (Chroma accepts only strings/numbers/bools)
  const cleanedDocs = splitDocs.map((d, i) => ({
    ...d,
    metadata: {
      id: i,                              // required unique metadata
      source: "pdf",
      page: d.metadata?.page || 0,
    }
  }));

  console.log("🧠 Creating embeddings & storing in Chroma...");

  await Chroma.fromDocuments(
    cleanedDocs,
    new OllamaEmbeddings({
      model: "mxbai-embed-large:latest",
    }),
    {
      collectionName: "pdf_rag",
      path: "./chroma_store", // make sure this folder exists or Chroma can create it
      persist: true            // important to save vectors on disk
    }
  );

  console.log("✅ Vector DB created at ./chroma_store");
}

ingestPDF();
