const { Command } = require('commander');
const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const multer = require('multer');

const program = new Command();

program
  .requiredOption('-h, --host <host>', 'server host')
  .requiredOption('-p, --port <port>', 'server port')
  .requiredOption('-c, --cache <dir>', 'cache directory');

program.parse(process.argv);
const options = program.opts();

if (!fs.existsSync(options.cache)) {
  fs.mkdirSync(options.cache, { recursive: true });
}

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const upload = multer({ dest: options.cache });

let inventory = [];
let nextId = 1;

app.get('/inventory', (req, res) => {
  const result = inventory.map(item => ({
    id: item.id,
    inventory_name: item.inventory_name,
    description: item.description,
    photoUrl: item.photoFilename ? `/inventory/${item.id}/photo` : null
  }));

  res.json(result);
});

app.get('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = inventory.find(i => i.id === id);

  if (!item) {
    return res.status(404).json({ error: 'not found' });
  }

  res.json({
    id: item.id,
    inventory_name: item.inventory_name,
    description: item.description,
    photoUrl: item.photoFilename ? `/inventory/${item.id}/photo` : null
  });
});

app.put('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = inventory.find(i => i.id === id);

  if (!item) {
    return res.status(404).json({ error: 'not found' });
  }

  const body = req.body;

  if (typeof body.inventory_name === 'string') {
    item.inventory_name = body.inventory_name;
  }

  if (typeof body.description === 'string') {
    item.description = body.description;
  }

  res.json({
    id: item.id,
    inventory_name: item.inventory_name,
    description: item.description,
    photoUrl: item.photoFilename ? `/inventory/${item.id}/photo` : null
  });
});

app.get('/inventory/:id/photo', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = inventory.find(i => i.id === id);

  if (!item || !item.photoFilename) {
    return res.status(404).json({ error: 'photo not found' });
  }

  const filePath = path.resolve(options.cache, item.photoFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'photo not found' });
  }

  res.setHeader('Content-Type', 'image/jpeg');
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = inventory.find(i => i.id === id);

  if (!item) {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(404).json({ error: 'not found' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'photo file is required' });
  }

  if (item.photoFilename) {
    const oldPath = path.join(options.cache, item.photoFilename);
    if (fs.existsSync(oldPath)) {
      fs.unlink(oldPath, () => {});
    }
  }

  item.photoFilename = path.basename(req.file.path);

  res.json({
    id: item.id,
    inventory_name: item.inventory_name,
    description: item.description,
    photoUrl: `/inventory/${item.id}/photo`
  });
});

app.post('/register', upload.single('photo'), (req, res) => {
  const name = req.body.inventory_name;
  const description = req.body.description || '';

  if (!name || name.trim() === '') {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(400).json({ error: 'inventory_name is required' });
  }

  const item = {
    id: nextId++,
    inventory_name: name.trim(),
    description,
    photoFilename: req.file ? path.basename(req.file.path) : null
  };

  inventory.push(item);

  res.status(201).json({
    id: item.id,
    inventory_name: item.inventory_name,
    description: item.description,
    photoUrl: item.photoFilename ? `/inventory/${item.id}/photo` : null
  });
});

const server = http.createServer(app);

server.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}/`);
  console.log(`Cache directory: ${path.resolve(options.cache)}`);
});

app.delete('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = inventory.findIndex(i => i.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'not found' });
  }

  const item = inventory[index];

  inventory.splice(index, 1);

  res.json({
    id: item.id,
    inventory_name: item.inventory_name,
    description: item.description
  });
});
