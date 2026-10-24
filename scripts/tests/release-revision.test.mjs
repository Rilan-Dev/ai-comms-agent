import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,realpathSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,delimiter,dirname,basename} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';

test('manual deployment uses the actual checkout revision for every Compose operation',t=>{
 const fixture=mkdtempSync(join(tmpdir(),'aca-release-revision-'));
 t.after(()=>{
  const target=realpathSync(fixture);
  assert.equal(dirname(target),realpathSync(tmpdir()));
  assert.ok(basename(target).startsWith('aca-release-revision-'));
  rmSync(target,{recursive:true,force:true});
 });
 mkdirSync(join(fixture,'scripts'));mkdirSync(join(fixture,'bin'));
 writeFileSync(join(fixture,'scripts/manual-up.sh'),readFileSync(new URL('../manual-up.sh',import.meta.url),'utf8').replaceAll('\r\n','\n'));
 writeFileSync(join(fixture,'.env'),'DATABASE_URL=test-only\n');
 writeFileSync(join(fixture,'docker-compose.yml'),'services: {}\n');
 const fixtureEnv={...process.env};
 for(const key of ['GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_COMMON_DIR'])delete fixtureEnv[key];
 const git=(...args)=>execFileSync('git',args,{cwd:fixture,encoding:'utf8',env:fixtureEnv}).trim();
 git('init','--quiet');git('config','user.name','Deployment fixture');git('config','user.email','qa@example.invalid');
 git('add','.');git('commit','--quiet','-m','Isolated deployment fixture');const revision=git('rev-parse','HEAD');
 const log=join(fixture,'compose-calls.jsonl');
 writeFileSync(join(fixture,'bin/docker'),`#!/usr/bin/env node
import('node:fs').then(fs=>fs.appendFileSync(process.env.ACA_TEST_COMPOSE_LOG,JSON.stringify({revision:process.env.ACA_RELEASE_REVISION,args:process.argv.slice(2)})+'\\n'));
`,{mode:0o755});
 const bash=process.env.ACA_TEST_BASH||(process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash');
 const result=spawnSync(bash,['scripts/manual-up.sh'],{cwd:fixture,encoding:'utf8',env:{...fixtureEnv,PATH:join(fixture,'bin')+delimiter+process.env.PATH,ACA_RELEASE_REVISION:'stale-parent-value',ACA_TEST_COMPOSE_LOG:log}});
 assert.equal(result.status,0,result.stderr||result.stdout||String(result.error));
 const calls=readFileSync(log,'utf8').trim().split('\n').map(line=>JSON.parse(line));
 const build=calls.find(call=>call.args.includes('build'));
 assert.ok(build,'the isolated Docker stub observed a build');assert.equal(build.revision,revision);
 for(const call of calls.filter(call=>!call.args.includes('version')))assert.equal(call.revision,revision);
});
