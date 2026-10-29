import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('worker container runs the signal-aware worker as the main process', async()=>{
 const dockerfile=await readFile(new URL('../../Dockerfile',import.meta.url),'utf8');
 const worker=dockerfile.split('FROM base AS worker')[1];
 assert.ok(worker);
 assert.match(worker,/WORKDIR \/workspace\/apps\/worker/);
 assert.match(worker,/CMD \["node",\s*"--import",\s*"tsx",\s*"src\/index\.ts"\]/);
});
