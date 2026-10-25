import type {AgentConfigurationSnapshotV1} from '@ai-comms-agent/shared';
import type {PoolClient} from 'pg';
import type {AgentConfigurationScope} from './configuration-revisions';

/** Validate current tenant/resource availability under row locks. Nothing
 * reconnects a provider, replaces a binding, reindexes knowledge or sends. */
export async function assertConfigurationResources(client:PoolClient,scope:AgentConfigurationScope,snapshot:AgentConfigurationSnapshotV1):Promise<void>{
 const emails=await client.query<{id:string;status:string;deleted_at:unknown}>(`SELECT id,status,deleted_at FROM email_accounts WHERE organization_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR SHARE`,[scope.organizationId,snapshot.channels.email.map(row=>row.accountId)]);
 if(emails.rows.length!==snapshot.channels.email.length||emails.rows.some(row=>row.status!=='connected'||row.deleted_at!==null))throw Error('An assigned mailbox is unavailable. Update Channels and review these changes again.');
 if(snapshot.channels.whatsappAccountId){const whatsapp=await client.query<{status:string;deleted_at:unknown}>('SELECT status,deleted_at FROM whatsapp_accounts WHERE organization_id=$1 AND id=$2 FOR SHARE',[scope.organizationId,snapshot.channels.whatsappAccountId]);if(whatsapp.rows.length!==1||whatsapp.rows[0]!.status!=='connected'||whatsapp.rows[0]!.deleted_at!==null)throw Error('The assigned WhatsApp phone is unavailable. Update Channels and review these changes again.');}
 if(snapshot.legacy.ai?.providerConfigId){const provider=await client.query('SELECT id FROM ai_provider_configs WHERE organization_id=$1 AND id=$2 FOR SHARE',[scope.organizationId,snapshot.legacy.ai.providerConfigId]);if(provider.rows.length!==1)throw Error('The saved AI provider reference is unavailable. Review AI settings before applying.');}
}
