const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 4000;
const MOCK_DIR = path.join(os.tmpdir(), 'losangelesbarber-mock');
const MOCK_DB_PATH = path.join(MOCK_DIR, 'db.json');
const MOCK_STORAGE_DIR = path.join(MOCK_DIR, 'storage');

function getMimeType(ext) {
    switch (ext.toLowerCase()) {
        case '.js': return 'text/javascript';
        case '.css': return 'text/css';
        case '.json': return 'application/json';
        case '.png': return 'image/png';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.webp': return 'image/webp';
        case '.svg': return 'image/svg+xml';
        default: return 'application/octet-stream';
    }
}

function readRequestBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

async function handleMockSupabase(req, res, urlPath) {
    fs.mkdirSync(MOCK_STORAGE_DIR, { recursive: true });

    if (urlPath === '/mock-supabase/db') {
        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            if (fs.existsSync(MOCK_DB_PATH)) {
                res.end(fs.readFileSync(MOCK_DB_PATH, 'utf8'));
            } else {
                res.end(JSON.stringify({ empty: true }));
            }
            return true;
        }
        if (req.method === 'POST') {
            const body = await readRequestBody(req);
            fs.writeFileSync(MOCK_DB_PATH, body.toString('utf8'), 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return true;
        }
    }

    if (urlPath.startsWith('/mock-supabase/storage/')) {
        const parts = urlPath.replace('/mock-supabase/storage/', '').split('/');
        const bucket = path.basename(decodeURIComponent(parts[0] || 'logos'));
        const fileName = path.basename(decodeURIComponent(parts.slice(1).join('/') || ''));
        if (!fileName) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing filename' }));
            return true;
        }
        const bucketDir = path.join(MOCK_STORAGE_DIR, bucket);
        fs.mkdirSync(bucketDir, { recursive: true });
        const targetPath = path.join(bucketDir, fileName);

        if (req.method === 'POST') {
            const body = await readRequestBody(req);
            fs.writeFileSync(targetPath, body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ path: fileName }));
            return true;
        }
        if (req.method === 'GET') {
            if (!fs.existsSync(targetPath)) {
                res.writeHead(404);
                res.end('Not found');
                return true;
            }
            res.writeHead(200, { 'Content-Type': getMimeType(path.extname(targetPath)) });
            res.end(fs.readFileSync(targetPath));
            return true;
        }
    }

    return false;
}

function parseSimpleYaml(yamlText) {
    const data = {};
    yamlText.split(/\r?\n/).forEach((line) => {
        const match = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.+?)\s*$/);
        if (!match) return;
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        data[match[1]] = val;
    });
    return data;
}

function loadSiteConfig() {
    const configPath = path.join(__dirname, '_config.yml');
    if (!fs.existsSync(configPath)) return {};
    return parseSimpleYaml(fs.readFileSync(configPath, 'utf8'));
}

function renderLiquidTokens(html, site, page) {
    // Procesar {% include file.html %}
    html = html.replace(/{%\s*include\s+(.*?)\s*%}/g, (match, p1) => {
        const incPath = path.join(__dirname, '_includes', p1.trim());
        return fs.existsSync(incPath) ? fs.readFileSync(incPath, 'utf8') : '';
    });

    // Procesar condicionales {% if site.prop %} ... {% endif %}
    html = html.replace(/{%\s*if\s+site\.([A-Za-z0-9_]+)\s*%}([\s\S]*?){%\s*endif\s*%}/g, (match, key, body) => {
        return site[key] ? body : '';
    });

    // Remover etiquetas SEO de Jekyll
    html = html.replace(/{%\s*seo\s*%}/g, '');

    // Reemplazar {{ '/ruta' | relative_url }}
    html = html.replace(/\{\{\s*'(.*?)'\s*\|\s*relative_url\s*\}\}/g, '$1');

    // Reemplazar {{ site.prop }} y {{ page.prop }}
    html = html.replace(/\{\{\s*site\.([A-Za-z0-9_]+)\s*\}\}/g, (m, key) => site[key] || '');
    html = html.replace(/\{\{\s*page\.([A-Za-z0-9_]+)\s*\}\}/g, (m, key) => page[key] || '');

    return html;
}

const server = http.createServer(async (req, res) => {
    let urlPath = req.url.split('?')[0];

    if (urlPath.startsWith('/mock-supabase/')) {
        const handled = await handleMockSupabase(req, res, urlPath);
        if (handled) return;
    }

    let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
    
    // Si la ruta termina en /admin o /admin/, servir admin/index.html
    if (urlPath === '/admin' || urlPath === '/admin/') {
        filePath = path.join(__dirname, 'admin', 'index.html');
    }
    
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }

    let statusCode = 200;
    if (!fs.existsSync(filePath)) {
        let custom404Path = path.join(__dirname, '404.html');
        if (fs.existsSync(custom404Path)) {
            filePath = custom404Path;
            statusCode = 404;
        } else {
            res.statusCode = 404;
            res.end('Not found: ' + filePath);
            return;
        }
    }

    let extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
        case '.js': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
        case '.json': contentType = 'application/json'; break;
        case '.png': contentType = 'image/png'; break;      
        case '.jpg': contentType = 'image/jpg'; break;
        case '.svg': contentType = 'image/svg+xml'; break;
    }

    let content = fs.readFileSync(filePath);

    // Mini-compilador Jekyll on-the-fly para HTML
    if (extname === '.html' || extname === '') {
        let contentStr = content.toString('utf8');
        const siteConfig = loadSiteConfig();
        let pageConfig = {};

        // Extraer y remover Frontmatter (--- ... ---)
        const fmMatch = contentStr.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
        if (fmMatch) {
            pageConfig = parseSimpleYaml(fmMatch[1]);
            contentStr = contentStr.slice(fmMatch[0].length);
        }

        contentStr = renderLiquidTokens(contentStr, siteConfig, pageConfig);

        // Aplicar layout (por defecto: default si existe)
        const layoutName = pageConfig.layout || 'default';
        if (layoutName !== 'none') {
            let layoutPath = path.join(__dirname, '_layouts', `${layoutName}.html`);
            if (fs.existsSync(layoutPath)) {
                let layoutStr = fs.readFileSync(layoutPath, 'utf8');
                layoutStr = layoutStr.replace('{{ content }}', contentStr);
                contentStr = renderLiquidTokens(layoutStr, siteConfig, pageConfig);
            }
        }
        
        res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(contentStr, 'utf-8');
    } else {
        res.writeHead(statusCode, { 'Content-Type': contentType });
        res.end(content);
    }
});

server.listen(PORT, () => {
    console.log(`\n✅ Servidor local (Simulador Jekyll) corriendo en:`);
    console.log(`➡️  http://localhost:${PORT}`);
    console.log(`\nPresiona Ctrl+C para detenerlo.\n`);
});
