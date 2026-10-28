import {test} from 'node:test';
import assert from 'node:assert/strict';
import {migrateFixture,seedBriefingFixture} from './helpers/briefing-db-fixture.mjs';
test('WhatsApp cleanup cannot cancel an approval that won the database race',async()=>{
 const {pool}=await migrateFixture();
 try{const ids=await seedBriefingFixture(pool);
 const account=(await pool.query("INSERT INTO aca.whatsapp_accounts(organization_id,phone_number_id,status) VALUES($1,'fixture-phone','connected') RETURNING id",[ids.orgA])).rows[0].id;
 for(let n=0;n<10;n++){
  const action=(await pool.query("INSERT INTO aca.whatsapp_send_actions(organization_id,whatsapp_account_id,recipient_phone,message_body) VALUES($1,$2,'+15550000001','fixture') RETURNING id",[ids.orgA,account])).rows[0].id;
  const [cancel,approve]=await Promise.all([
   pool.query("UPDATE aca.whatsapp_send_actions SET status='rejected' WHERE organization_id=$1 AND whatsapp_account_id=$2 AND id=ANY($3::uuid[]) AND status IN ('pending','requires_template') AND queued_message_id IS NULL RETURNING id",[ids.orgA,account,[action]]),
   pool.query("UPDATE aca.whatsapp_send_actions SET status='approved' WHERE id=$1 AND organization_id=$2 AND status='pending' RETURNING id",[action,ids.orgA])]);
  assert.equal(cancel.rowCount+approve.rowCount,1);
  const current=(await pool.query('SELECT status,queued_message_id FROM aca.whatsapp_send_actions WHERE id=$1',[action])).rows[0];
  assert.equal(current.status,cancel.rowCount?'rejected':'approved');assert.equal(current.queued_message_id,null);
 }
 }finally{await pool.end();}
});
