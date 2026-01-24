import http from 'node:http';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.STT_WORKER_PORT || 8787);
const START_URL = process.env.STT_START_URL || 'http://localhost:3000/api/stt/start';

function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => {
            data += chunk;
        });
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
}

function runWorker(prefix) {
    return new Promise((resolve, reject) => {
        const args = ['scripts/stt-worker.mjs', '--prefix', prefix, '--start-url', START_URL];
        const child = spawn('node', args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(stderr || 'Worker failed'));
                return;
            }
            try {
                const json = JSON.parse(stdout);
                resolve(json);
            } catch (error) {
                reject(error);
            }
        });
    });
}

const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/stt/start') {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
    }

    try {
        const body = await readBody(req);
        const payload = JSON.parse(body || '{}');
        const prefix = payload.prefix;
        if (!prefix) {
            res.writeHead(400, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'prefix is required' }));
            return;
        }
        const result = await runWorker(prefix);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(result));
    } catch (error) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Worker error' }));
    }
});

server.listen(PORT, () => {
    console.log(`[stt-worker-server] listening on http://localhost:${PORT}`);
});
