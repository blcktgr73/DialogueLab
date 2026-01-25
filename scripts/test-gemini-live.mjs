#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv() {
  const candidates = [
    path.resolve(__dirname, '..', '.env.local'),
    'C:/Projects/DialogueLab/.env.local',
    '/mnt/c/Projects/DialogueLab/.env.local',
  ];

  const envPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!envPath) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const match = line.trim().match(/^([^=]+)=(.*)$/);
    if (!match) return;
    const key = match[1].trim();
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  });
}

function parseArgs(argv) {
  const args = {
    text: '안녕하세요. Gemini Live 연결 테스트입니다.',
    mode: 'text',
    model: process.env.GEMINI_LIVE_MODEL || 'models/gemini-2.0-flash-exp',
    url: 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent',
    useQueryKey: false,
    verbose: false,
    audioFile: null,
    mic: false,
    micCmd: null,
    inputRate: 16000,
    chunkMs: 100,
    audioOut: null,
    play: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--text') {
      args.text = argv[i + 1] ?? args.text;
      i += 1;
    } else if (arg === '--mode') {
      args.mode = argv[i + 1] ?? args.mode;
      i += 1;
    } else if (arg === '--model') {
      args.model = argv[i + 1] ?? args.model;
      i += 1;
    } else if (arg === '--url') {
      args.url = argv[i + 1] ?? args.url;
      i += 1;
    } else if (arg === '--audio-file') {
      args.audioFile = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === '--mic') {
      args.mic = true;
    } else if (arg === '--mic-cmd') {
      args.micCmd = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === '--input-rate') {
      args.inputRate = Number(argv[i + 1] ?? args.inputRate);
      i += 1;
    } else if (arg === '--chunk-ms') {
      args.chunkMs = Number(argv[i + 1] ?? args.chunkMs);
      i += 1;
    } else if (arg === '--audio-out') {
      args.audioOut = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === '--play') {
      args.play = true;
    } else if (arg === '--use-query-key') {
      args.useQueryKey = true;
    } else if (arg === '--verbose') {
      args.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp() {
  console.log(`\nGemini Live smoke test (WebSocket)

Usage:
  node test-gemini-live.mjs --mode text --text "hello"
  node test-gemini-live.mjs --mode audio --audio-file ./input.pcm --audio-out ./output.pcm
  node test-gemini-live.mjs --mode audio --mic --play

Options:
  --mode text|audio      Response modality (default: text)
  --text "..."           Text prompt (text mode)
  --audio-file PATH      Raw PCM 16-bit mono file (audio/pcm;rate=16000)
  --mic                 Read raw PCM 16-bit mono from stdin (audio/pcm;rate=16000)
  --mic-cmd "CMD"        Spawn command that outputs raw PCM to stdout (overrides --mic)
  --input-rate N         Input sample rate for mimeType (default: 16000)
  --chunk-ms N           Chunk size for streaming file input (default: 100)
  --audio-out PATH       Save model audio (raw PCM 24kHz) to file
  --play                Play model audio using ffplay/play if available
  --model MODEL          Live model name
  --url URL              WebSocket endpoint
  --use-query-key        Use ?key= API key instead of header
  --verbose              Log raw messages\n`);
}

async function getWebSocketCtor() {
  if (globalThis.WebSocket) return globalThis.WebSocket;
  try {
    const ws = await import('ws');
    return ws.WebSocket || ws.default;
  } catch (err) {
    console.error('[gemini-live] WebSocket is not available. Use Node 20+ or install ws.');
    process.exit(1);
  }
}

function send(ws, payload, verbose) {
  const message = JSON.stringify(payload);
  if (verbose) console.log('[gemini-live] ->', message);
  ws.send(message);
}

function logServer(message, verbose) {
  if (!verbose) return;
  console.log('[gemini-live] <-', JSON.stringify(message));
}

function commandAvailable(command) {
  const isWin = process.platform === 'win32';
  const check = isWin ? spawnSync('where', [command]) : spawnSync('which', [command]);
  return check.status === 0;
}

function startPlayer(rate) {
  const candidates = [
    ['ffplay', ['-f', 's16le', '-ar', String(rate), '-ac', '1', '-nodisp', '-autoexit', '-loglevel', 'quiet', '-']],
    ['play', ['-t', 'raw', '-r', String(rate), '-e', 'signed-integer', '-b', '16', '-c', '1', '-']],
  ];

  for (const [cmd, cmdArgs] of candidates) {
    if (!commandAvailable(cmd)) {
      continue;
    }
    const child = spawn(cmd, cmdArgs, { stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('error', () => {});
    return child;
  }

  console.warn('[gemini-live] Audio player not available (ffplay/play). Use --audio-out to save PCM.');
  return null;
}

function createAudioSink(args) {
  const sink = {
    fileStream: null,
    player: null,
    write(buffer) {
      if (this.fileStream) this.fileStream.write(buffer);
      if (this.player?.stdin?.writable) this.player.stdin.write(buffer);
    },
    close() {
      if (this.fileStream) this.fileStream.end();
      if (this.player?.stdin?.writable) this.player.stdin.end();
    },
  };

  if (args.audioOut) {
    sink.fileStream = fs.createWriteStream(args.audioOut);
  }

  if (args.play) {
    sink.player = startPlayer(24000);
  }

  return sink;
}

function streamBufferToRealtime(ws, buffer, args) {
  const bytesPerMs = Math.floor((args.inputRate * 2) / 1000);
  const chunkBytes = Math.max(bytesPerMs * args.chunkMs, 3200);
  let offset = 0;

  const interval = setInterval(() => {
    if (offset >= buffer.length) {
      clearInterval(interval);
      send(ws, { realtimeInput: { audioStreamEnd: true } }, args.verbose);
      return;
    }

    const end = Math.min(offset + chunkBytes, buffer.length);
    const chunk = buffer.subarray(offset, end);
    offset = end;

    sentAudioBytes += chunk.length;
    send(ws, {
      realtimeInput: {
        audio: {
          data: chunk.toString('base64'),
          mimeType: `audio/pcm;rate=${args.inputRate}`,
        },
      },
    }, args.verbose);
  }, args.chunkMs);
}

function streamReadableToRealtime(ws, readable, args) {
  let pending = Buffer.alloc(0);
  const bytesPerMs = Math.floor((args.inputRate * 2) / 1000);
  const chunkBytes = Math.max(bytesPerMs * args.chunkMs, 3200);

  readable.on('data', (chunk) => {
    pending = Buffer.concat([pending, chunk]);
    while (pending.length >= chunkBytes) {
      const piece = pending.subarray(0, chunkBytes);
      pending = pending.subarray(chunkBytes);
      sentAudioBytes += piece.length;
      send(ws, {
        realtimeInput: {
          audio: {
            data: piece.toString('base64'),
            mimeType: `audio/pcm;rate=${args.inputRate}`,
          },
        },
      }, args.verbose);
    }
  });

  readable.on('end', () => {
    if (pending.length > 0) {
      sentAudioBytes += pending.length;
      send(ws, {
        realtimeInput: {
          audio: {
            data: pending.toString('base64'),
            mimeType: `audio/pcm;rate=${args.inputRate}`,
          },
        },
      }, args.verbose);
    }
    send(ws, { realtimeInput: { audioStreamEnd: true } }, args.verbose);
  });
}

function spawnMicCommand(cmd) {
  const child = spawn(cmd, { shell: true, stdio: ['ignore', 'pipe', 'inherit'] });
  return child;
}

loadEnv();
const args = parseArgs(process.argv);
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

if (!apiKey) {
  console.error('[gemini-live] GEMINI_API_KEY (or GOOGLE_GEMINI_API_KEY) not found in .env.local');
  process.exit(1);
}

const WS = await getWebSocketCtor();
const wsUrl = args.useQueryKey ? `${args.url}?key=${encodeURIComponent(apiKey)}` : args.url;

const headers = args.useQueryKey
  ? undefined
  : {
      'x-goog-api-key': apiKey,
    };

const ws = new WS(wsUrl, headers ? { headers } : undefined);
const audioSink = createAudioSink(args);

let accumulatedText = '';
let setupDone = false;
let inputEnded = false;
let receivedTurnComplete = false;
let sentAudioBytes = 0;
let receivedAudioBytes = 0;
let receivedAudioChunks = 0;

ws.onopen = () => {
  console.log(`[gemini-live] Connected (${wsUrl})`);

  const responseModality = args.mode === 'audio' ? 'AUDIO' : 'TEXT';

  const setup = {
    setup: {
      model: args.model,
      systemInstruction: {
        parts: [{ text: 'You are a concise test assistant. Reply in Korean.' }],
      },
      generationConfig: {
        responseModalities: [responseModality],
        temperature: 0.2,
      },
    },
  };

  if (responseModality === 'AUDIO') {
    setup.setup.outputAudioTranscription = {};
    setup.setup.inputAudioTranscription = {};
  }

  send(ws, setup, args.verbose);
};

ws.onmessage = async (event) => {
  let raw = event.data;
  if (raw instanceof ArrayBuffer) {
    raw = Buffer.from(raw).toString('utf8');
  } else if (raw instanceof Uint8Array) {
    raw = Buffer.from(raw).toString('utf8');
  } else if (typeof raw === 'object' && raw?.arrayBuffer) {
    const buffer = Buffer.from(await raw.arrayBuffer());
    raw = buffer.toString('utf8');
  }

  const message = JSON.parse(typeof raw === 'string' ? raw : String(raw));
  logServer(message, args.verbose);

  if (message.setupComplete) {
    setupDone = true;
    console.log('[gemini-live] Setup complete');

    if (args.mode === 'text') {
      send(ws, {
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [{ text: args.text }],
            },
          ],
          turnComplete: true,
        },
      }, args.verbose);
      return;
    }

    if (args.audioFile) {
      const audioBuffer = fs.readFileSync(args.audioFile);
      streamBufferToRealtime(ws, audioBuffer, args);
      inputEnded = true;
      return;
    }

    if (args.micCmd) {
      const mic = spawnMicCommand(args.micCmd);
      streamReadableToRealtime(ws, mic.stdout, args);
      mic.on('close', () => {
        inputEnded = true;
      });
      return;
    }

    if (args.mic) {
      streamReadableToRealtime(ws, process.stdin, args);
      process.stdin.resume();
      process.stdin.on('end', () => {
        inputEnded = true;
      });
      return;
    }

    console.log('[gemini-live] Audio mode requires --audio-file or --mic');
    ws.close();
    return;
  }

  if (message.serverContent?.modelTurn?.parts) {
    for (const part of message.serverContent.modelTurn.parts) {
      if (part.text) accumulatedText += part.text;
      if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith('audio')) {
        const audioData = Buffer.from(part.inlineData.data, 'base64');
        receivedAudioBytes += audioData.length;
        receivedAudioChunks += 1;
        audioSink.write(audioData);
      }
    }
  }

  if (message.serverContent?.outputTranscription?.text) {
    accumulatedText += message.serverContent.outputTranscription.text;
  }

  if (message.serverContent?.inputTranscription?.text) {
    console.log(`[gemini-live] Input transcription: ${message.serverContent.inputTranscription.text}`);
  }

  if (message.serverContent?.turnComplete) {
    receivedTurnComplete = true;
    if (accumulatedText) {
      console.log('\n[gemini-live] Response text:');
      console.log(accumulatedText);
    } else {
      console.log('[gemini-live] turnComplete received (no text)');
    }

    if (args.mode === 'text') {
      ws.close();
      return;
    }

    if (inputEnded) {
      console.log(`[gemini-live] Received audio bytes: ${receivedAudioBytes} (chunks: ${receivedAudioChunks})`);
      if (receivedAudioBytes === 0) {
        console.warn('[gemini-live] No audio data received. Try another model or check response modalities.');
      }
      console.log(`[gemini-live] Sent audio bytes: ${sentAudioBytes}`);
      ws.close();
    }
  }

  if (message.serverContent?.interrupted) {
    console.warn('[gemini-live] Generation interrupted (VAD)');
  }

  if (message.error) {
    console.error('[gemini-live] Error:', message.error);
    ws.close();
  }
};

ws.onerror = (err) => {
  console.error('[gemini-live] WS error:', err);
};

ws.onclose = () => {
  audioSink.close();
  if (!setupDone) {
    console.error('[gemini-live] Connection closed before setup completed.');
  } else if (receivedTurnComplete) {
    console.log('[gemini-live] Disconnected');
  }
};
