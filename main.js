const { Command } = require('commander');
const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const multer = require('multer');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

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

// Допоміжна функція для формування відповіді
function itemToDto(item) {
  return {
    id: item.id,
    inventory_name: item.inventory_name,
    description: item.description,
    photoUrl: item.photoFilename ? `/inventory/${item.id}/photo` : null,
  };
}

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Inventory Service',
      version: '1.0.0',
      description: 'Simple inventory API for lab work',
    },
    components: {
      schemas: {
        InventoryItem: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            inventory_name: { type: 'string' },
            description: { type: 'string' },
            photoUrl: { type: 'string', nullable: true },
          },
        },
      },
    },
  },
  apis: [__filename],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Обмеження методів (405)
app.all('/register', (req, res, next) => {
  if (req.method === 'POST') return next();
  res.sendStatus(405);
});
app.all('/inventory', (req, res, next) => {
  if (req.method === 'GET') return next();
  res.sendStatus(405);
});
app.all('/inventory/:id', (req, res, next) => {
  if (['GET', 'PUT', 'DELETE'].includes(req.method)) return next();
  res.sendStatus(405);
});
app.all('/inventory/:id/photo', (req, res, next) => {
  if (['GET', 'PUT'].includes(req.method)) return next();
  res.sendStatus(405);
});
app.all('/search', (req, res, next) => {
  if (req.method === 'GET') return next();
  res.sendStatus(405);
});

// Статичні HTML-сторінки (форми)
app.get('/RegisterForm.html', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'RegisterForm.html'));
});
app.get('/SearchForm.html', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'SearchForm.html'));
});

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Get all inventory items
 *     responses:
 *       200:
 *         description: List of inventory items
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/InventoryItem'
 */
app.get('/inventory', (req, res) => {
  res.json(inventory.map(itemToDto));
});

/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     summary: Get inventory item by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Inventory item
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItem'
 *       404:
 *         description: Not found
 */
app.get('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = inventory.find(i => i.id === id);
  if (!item) {
    return res.status(404).json({ error: 'not found' });
  }
  res.json(itemToDto(item));
});

/**
 * @swagger
 * /inventory/{id}:
 *   put:
 *     summary: Update inventory item
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated item
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItem'
 *       404:
 *         description: Not found
 */
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
  res.json(itemToDto(item));
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   get:
 *     summary: Get photo for inventory item
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Photo file
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Photo not found
 */
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
  fs.createReadStream(filePath).pipe(res);
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   put:
 *     summary: Upload or replace photo for inventory item
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Item with updated photo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItem'
 *       404:
 *         description: Not found
 */
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
  res.json(itemToDto(item));
});

/**
 * @swagger
 * /search:
 *   get:
 *     summary: Search inventory item by id (HTML response)
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: includePhoto
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: HTML page with search result
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       404:
 *         description: Item not found
 */
app.get('/search', (req, res) => {
  const id = parseInt(req.query.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).send('Invalid id');
  }

  const item = inventory.find(i => i.id === id);
  if (!item) {
    return res.status(404).send('Item not found');
  }

  let description = item.description || '';
  let photoBlock = '';

  if (req.query.includePhoto !== undefined && item.photoFilename) {
    const photoUrl = `/inventory/${item.id}/photo`;
    if (description) {
      description += '<br>';
    }
    description += `Photo link: <a href="${photoUrl}">${photoUrl}</a>`;

    photoBlock = `
      <p>
        <img src="${photoUrl}"
             alt="photo of ${item.inventory_name}"
             style="max-width:300px;">
      </p>
    `;
  }
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Search result</title>
    </head>
    <body>
      <h1>Search result</h1>
      <p><strong>ID:</strong> ${item.id}</p>
      <p><strong>Name:</strong> ${item.inventory_name}</p>
      <p><strong>Description:</strong><br>${description}</p>
      ${photoBlock}
      <p><a href="/SearchForm.html">Back to search</a></p>
    </body>
    </html>
  `);
});

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Register new inventory item
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *               description:
 *                 type: string
 *               photo:
 *                 type: string
 *                 format: binary
 *             required:
 *               - inventory_name
 *     responses:
 *       201:
 *         description: Created item
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItem'
 *       400:
 *         description: Bad request
 */
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
    photoFilename: req.file ? path.basename(req.file.path) : null,
  };

  inventory.push(item);
  res.status(201).json(itemToDto(item));
});

/**
 * @swagger
 * /inventory/{id}:
 *   delete:
 *     summary: Delete inventory item
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted item
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItem'
 *       404:
 *         description: Not found
 */
app.delete('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = inventory.findIndex(i => i.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'not found' });
  }

  const item = inventory[index];
  inventory.splice(index, 1);
  res.json(itemToDto(item));
});

const server = http.createServer(app);
server.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}/`);
  console.log(`Cache directory: ${path.resolve(options.cache)}`);
});
