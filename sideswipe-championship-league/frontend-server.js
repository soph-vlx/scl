import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;
const API_PORT = process.env.SCL_API_PORT || 4300;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use('/api', async (req, res) => {
  try {
    const apiUrl = `http://localhost:${API_PORT}/api${req.url}`;
    const forwardHeaders = { ...req.headers };
    delete forwardHeaders.host;
    
    const response = await axios({
      method: req.method,
      url: apiUrl,
      data: req.body,
      headers: forwardHeaders,
      timeout: 5000,
      validateStatus: () => true,
      responseType: 'stream'
    });
    
    res.status(response.status);
    Object.entries(response.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    response.data.pipe(res);
  } catch (error) {
    console.error('API proxy error:', error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'API request failed',
      message: error.message 
    });
  }
});

app.use(express.static(path.join(__dirname, 'website-scl')));

app.get('*', (req, res) => {
  let requestPath = req.path;
  
  if (!path.extname(requestPath) && requestPath !== '/') {
    requestPath = requestPath + '.html';
  }
  
  const filePath = path.join(__dirname, 'website-scl', requestPath);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, 'website-scl', 'index.html'));
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SCL Frontend server running on http://0.0.0.0:${PORT}`);
  console.log(`Proxying API requests to http://localhost:${API_PORT}`);
});
