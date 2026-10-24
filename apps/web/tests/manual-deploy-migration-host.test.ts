import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../../../scripts/manual-up.sh',import.meta.url),'utf8');
describe('manual deployment migration network boundary',()=>{
 it('uses the application network and preflights the same configured database before migration',()=>{
  const preflight=script.indexOf('web node packages/db/manual-db-preflight.mjs');
  const migration=script.indexOf('web node packages/db/migrate.js');
  const startup=script.indexOf('"${COMPOSE[@]}" up -d');
  expect(preflight).toBeGreaterThan(0);expect(migration).toBeGreaterThan(preflight);expect(startup).toBeGreaterThan(migration);
  expect(script).toContain('--no-deps');expect(script).not.toContain('host.docker.internal/127.0.0.1');
  expect(script).toContain('No automatic target replacement or retry');
 });
});