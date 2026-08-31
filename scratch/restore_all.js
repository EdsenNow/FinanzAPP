import fs from 'fs';

const logPath = 'C:/Users/edsen/.gemini/antigravity-ide/brain/dfe28d2d-61a3-4b03-885b-741859a47b20/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

function extractFileSlices(indices) {
  let combined = '';
  for (const idx of indices) {
    const obj = JSON.parse(lines[idx]);
    const text = obj.content;
    // Format is like "The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>.\n1: ...\n"
    const cleaned = text.split('\n')
      .filter(l => /^\d+:\s/.test(l))
      .map(l => l.replace(/^\d+:\s?/, ''))
      .join('\n');
    combined += (combined ? '\n' : '') + cleaned;
  }
  return combined;
}

// 1. Configuracion.html: lines 557 (1-200), 559 (200-420), 546 (400-558)
// Let's inspect them
const html1 = JSON.parse(lines[557]).content.split('\n').filter(l => /^\d+:\s/.test(l)).map(l => l.replace(/^\d+:\s?/, '')).slice(0, 199).join('\n');
const html2 = JSON.parse(lines[559]).content.split('\n').filter(l => /^\d+:\s/.test(l)).map(l => l.replace(/^\d+:\s?/, '')).slice(0, 200).join('\n');
const html3 = JSON.parse(lines[546]).content.split('\n').filter(l => /^\d+:\s/.test(l)).map(l => l.replace(/^\d+:\s?/, '')).join('\n');

console.log('html1 length:', html1.length, 'html2 length:', html2.length, 'html3 length:', html3.length);

// Also check if there were subsequent replacements to Configuracion.html
// Let's replay all replace_file_content that happened after line 560 on Configuracion.html, Configuracion.js, Configuracion.css
