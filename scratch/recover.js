import fs from 'fs';
import path from 'path';

const logPath = 'C:/Users/edsen/.gemini/antigravity-ide/brain/dfe28d2d-61a3-4b03-885b-741859a47b20/.system_generated/logs/transcript_full.jsonl';
const altLogPath = 'C:/Users/edsen/.gemini/antigravity-ide/brain/dfe28d2d-61a3-4b03-885b-741859a47b20/.system_generated/logs/transcript.jsonl';

const actualLog = fs.existsSync(logPath) ? logPath : altLogPath;
console.log('Reading from:', actualLog);

const lines = fs.readFileSync(actualLog, 'utf8').split('\n');

// Find all tool calls that touched Configuracion.html, Configuracion.js, Configuracion.css, tema-oscuro.css, tema-claro.css
const fileMap = {};

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.tool_calls) {
      for (const tc of obj.tool_calls) {
        if (tc.name === 'write_to_file') {
          const tf = tc.args.TargetFile;
          fileMap[tf] = tc.args.CodeContent;
          console.log('write_to_file:', tf);
        } else if (tc.name === 'replace_file_content') {
          const tf = tc.args.TargetFile;
          if (fileMap[tf]) {
            const { TargetContent, ReplacementContent } = tc.args;
            if (fileMap[tf].includes(TargetContent)) {
              fileMap[tf] = fileMap[tf].replace(TargetContent, ReplacementContent);
              console.log('replace_file_content SUCCESS on:', tf);
            } else {
              console.warn('replace_file_content TargetContent NOT found in virtual file on:', tf);
            }
          }
        }
      }
    }
  } catch (e) {}
}

console.log('Recovered files:', Object.keys(fileMap));

for (const [filePath, content] of Object.entries(fileMap)) {
  if (filePath.includes('Configuracion')) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('RESTORED:', filePath, 'Bytes:', content.length);
  }
}
