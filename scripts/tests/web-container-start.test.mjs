import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('web container starts Next directly under a signal-forwarding init', async()=>{
 const dockerfile=await readFile(new URL('../../Dockerfile',import.meta.url),'utf8');
 const web=dockerfile.split('FROM base AS web')[1]?.split('FROM base AS worker')[0];
 assert.ok(web);
 assert.match(web,/CMD \["node",\s*"apps\/web\/node_modules\/next\/dist\/bin\/next",\s*"start",\s*"apps\/web",\s*"-p",\s*"3000"\]/);
 const compose=await readFile(new URL('../../docker-compose.yml',import.meta.url),'utf8');
 const section=compose.split(/\n  web:\s*\n/)[1]?.split(/\n  worker:\s*\n/)[0];
 assert.ok(section);assert.match(section,/(?:^|\n)    init: true\s*\n/);
});
