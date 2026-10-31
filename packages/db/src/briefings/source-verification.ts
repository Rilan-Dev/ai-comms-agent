import type {PoolClient} from 'pg';
import type {TrustedBriefingPrincipal} from '@ai-comms-agent/shared';
import {requireBriefingIds,resolveBriefingScopeInTransaction} from './access';

type Source={messageId:string;mailboxId:string;contentRevision:string};
/** Current personal grants and immutable source revisions are checked before
 * requesting bounded metadata work. Returning false commits the request; it
 * never acknowledges personal review or changes a provider read flag. */
export async function ensureBriefingSourceFlags(client:PoolClient,p:TrustedBriefingPrincipal,mailboxIds:string[],sources:Source[],request=true):Promise<boolean>{
 if(!Array.isArray(sources)||sources.length>200||new Set(sources.map(source=>source.messageId)).size!==sources.length)throw Error('Invalid source verification page');
 const scope=await resolveBriefingScopeInTransaction(client,p,mailboxIds);
 if(!sources.length)return true;
 for(const source of sources){requireBriefingIds(source.messageId,source.mailboxId);if(!scope.mailboxIds.includes(source.mailboxId)||!/^[0-9a-f]{64}$/.test(source.contentRevision))throw Error('Source scope changed');}
 const rows=(await client.query(`SELECT m.id,m.email_account_id,m.is_draft,m.is_sent,m.provider_message_id,briefing_content_revision(m.id) revision,
   (m.provider_flags_observed_at>=now()-interval '5 minutes' AND m.provider_flags_observation_revision=mail_provider_observation_revision(m.id)) verified
   FROM email_messages m WHERE m.organization_id=$1 AND m.email_account_id=ANY($2::uuid[]) AND m.id=ANY($3::uuid[])`,
   [p.organizationId,scope.mailboxIds,sources.map(source=>source.messageId)])).rows;
 const expected=new Map(sources.map(source=>[source.messageId,source]));
 if(rows.length!==sources.length||rows.some(row=>row.is_draft||row.is_sent||!row.provider_message_id||row.email_account_id!==expected.get(row.id)?.mailboxId||row.revision!==expected.get(row.id)?.contentRevision))throw Error('Briefing source changed');
 const stale=rows.filter(row=>row.verified!==true).map(row=>row.id);
 if(stale.length&&request)await client.query(`UPDATE email_messages SET provider_flags_requested_at=coalesce(provider_flags_requested_at,clock_timestamp())
   WHERE organization_id=$1 AND email_account_id=ANY($2::uuid[]) AND id=ANY($3::uuid[])`,[p.organizationId,scope.mailboxIds,stale]);
 return stale.length===0;
}
