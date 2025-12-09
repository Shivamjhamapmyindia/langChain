import express from 'express';
import path from 'node:path';
import cors from 'cors';
import { llmWithTools } from './langChain.js';
import { v4 as uuidv4 } from 'uuid';
import { weatherTool, addTool } from './tools.js'; // Correct import here


const app = express();
const port = 3000;
// Simple in-memory storage for SSE channels
const streams = new Map();

app.use(express.json());
app.use(cors());


app.use(express.static(path.join(path.resolve(), 'public')));
const __dirname = path.dirname(new URL(import.meta.url).pathname);

app.get('/', (req, res) => {
  res.render(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint to handle chat messages
app.post('/chat', async (req, res) => {
  const { message } = req.body;
  if(!message) return res.status(400).json({ error: 'missing message' });

  const id = uuidv4();
  // create a simple stream holder
  streams.set(id, { chunks: [] });

  // process the chat async (fire-and-forget) — results will be streamed via SSE
  void (async () => {
    try {
      // 1. initial ask
      const initial = await llmWithTools.invoke([
        { role: 'system', content: 'You are a helpful assistant that can call tools.' },
        { role: 'user', content: message },
      ]);

      // 2. execute tool calls
      const toolResponses = [];
      for(const call of initial.tool_calls ?? []){
        // console.log(call);
        let toolResult;
        if(call.name === 'get_current_weather') {
            toolResult = await weatherTool.func(call.args)
            console.log('Weather Tool Result:', toolResult);
        };
        if(call.name === 'add_two_numbers') toolResult = await addTool.func(call.args);

          const serialized =
    typeof toolResult === 'object'
      ? JSON.stringify(toolResult, null, 2) // pretty JSON
      : String(toolResult);
        toolResponses.push({ id: call.id, name: call.name, content: serialized });
      }

      // 3. final response
      const messages = [
        { role: 'system', content: 'You are a helpful assistant that can call tools.' },
        { role: 'user', content: message },
      ];

      // push tool outputs as tool messages (so LLM can use them)
      for(const tr of toolResponses){
        messages.push({ role: 'tool', tool_call_id: tr.id, content: tr.content });
      }

      const finalResp = await llmWithTools.invoke(messages);
      const text = finalResp.content ?? '';

      // stream out tool messages first (if any)
      const stream = streams.get(id);
      if(!stream) return;

      // send tool outputs as dedicated SSE events
      for(const tr of toolResponses){
        stream.chunks.push(JSON.stringify({ type: 'tool', content: tr.content }));
      }

      // Now chunk final text and push tokens
      const chunkSize = 16;
      for(let i=0;i<text.length;i+=chunkSize){
        const chunk = text.slice(i, i+chunkSize);
        stream.chunks.push(JSON.stringify({ type: 'token', content: chunk }));
        // small pause to allow visible streaming effect
        await new Promise(r => setTimeout(r, 40));
      }

      // finally signal done
      stream.chunks.push(JSON.stringify({ type: 'done' }));

    }catch(err){
      console.error('chat processing error', err);
      const stream = streams.get(id);
      if(stream) stream.chunks.push(JSON.stringify({ type: 'token', content: '\n[Error from server]' }));
      if(stream) stream.chunks.push(JSON.stringify({ type: 'done' }));
    }
  })();

  res.json({ id });
});

// SSE endpoint
app.get('/events/:id', (req, res) => {
  const { id } = req.params;
  if(!streams.has(id)) streams.set(id, { chunks: [] });
  const stream = streams.get(id);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const interval = setInterval(() => {
    while(stream.chunks.length){
      const payload = stream.chunks.shift();
      res.write(`data: ${payload}\n\n`);
    }
  }, 100);

  req.on('close', () => {
    clearInterval(interval);
    streams.delete(id);
  });
});



app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});