
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { ChatOllama } from '@langchain/ollama';
import { tool } from '@langchain/core/tools';
import * as z from 'zod';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

// Simple in-memory storage for SSE channels
const streams = new Map();

// Create LLM
const llm = new ChatOllama({ model: 'qwen3:0.6b', streaming: true ,think: false});

// Tools
const weatherTool = tool(
  async ({ location }) => {
    // In real app call a live weather API
    const data = [
      {
        city: "San Francisco",
        temperature: "15°C",
        condition: "Partly Cloudy",
        forecast: [
          { day: "Today", temperature: "16°C", condition: "Sunny" },
          { day: "Tomorrow", temperature: "17°C", condition: "Partly Cloudy" },
        ],
      },
      {
        city: "New York",
        temperature: "20°C",
        condition: "Sunny",
        forecast: [
          { day: "Today", temperature: "21°C", condition: "Sunny" },
          { day: "Tomorrow", temperature: "22°C", condition: "Partly Cloudy" },
        ],
      },
      {
        city: "Los Angeles",
        temperature: "25°C",
        condition: "Sunny",
        forecast: [
          { day: "Today", temperature: "26°C", condition: "Sunny" },
          { day: "Tomorrow", temperature: "27°C", condition: "Partly Cloudy" },
        ],
      },
      {
        city: "Chicago",
        temperature: "10°C",
        condition: "Cloudy",
        forecast: [
          { day: "Today", temperature: "11°C", condition: "Cloudy" },
          { day: "Tomorrow", temperature: "12°C", condition: "Rain" },
        ],
      },
    ];

    const query = location.toLowerCase().trim();

    // Find exact OR partial match (case-insensitive)
    const match = data.find(d => d.city.toLowerCase().includes(query));

    return match || null;
  },
  {
    name: "get_current_weather",
    description: "Get current weather for a city (case-insensitive, partial match supported)",
    schema: z.object({ location: z.string() }),
  }
);


const addTool = tool(async ({ a, b }) => {
  return a + b;
}, {
  name: 'add_two_numbers',
  description: 'Add two numbers',
  schema: z.object({ a: z.number(), b: z.number() })
});

const llmWithTools = llm.bindTools([weatherTool, addTool]);

// POST /chat -> returns { id }
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port', PORT));
