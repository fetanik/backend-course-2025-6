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

