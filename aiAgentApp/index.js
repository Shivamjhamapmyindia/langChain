import express from 'express';
import path from 'node:path';
const app = express();
const port = 3000;

app.use(express.static(path.join(path.resolve(), 'public')));
const __dirname = path.dirname(new URL(import.meta.url).pathname);

app.get('/', (req, res) => {
  res.render(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});