import {query} from '../client';
import type {TrustedBriefingPrincipal} from '@ai-comms-agent/shared';
export type PendingBriefingWork=TrustedBriefingPrincipal&{manifestId:string;language:string};

/** Worker-only discovery; claim/loading/publication independently reauthorize
 * every persisted principal. Scheduled jobs require their separate adapter. */
export async function listPendingBriefingWork():Promise<PendingBriefingWork[]>{
  return (await query<PendingBriefingWork>(`SELECT j.organization_id AS "organizationId",j.owner_user_id AS "userId",
    j.agent_id AS "agentId",s.id AS "manifestId",coalesce(s.coverage_metadata->>'language','en') AS language
    FROM briefing_generation_jobs j JOIN summaries s ON s.id=j.summary_id AND s.organization_id=j.organization_id
      AND s.owner_user_id=j.owner_user_id AND s.agent_id=j.agent_id
    WHERE s.briefing_mode='catch_up' AND s.briefing_status IN ('pending','partial') AND s.derived_expires_at>now()
      AND EXISTS(SELECT 1 FROM briefing_generation_batches b WHERE b.job_id=j.id
        AND (b.status='pending' OR (b.status='running' AND b.lease_expires_at<=now())))
    ORDER BY j.updated_at,j.id LIMIT 2`)).rows;
}
/** A revoked/stale scope must not permanently starve another owner's work. */
export async function deferBriefingWork(work:PendingBriefingWork):Promise<void>{
  await query(`UPDATE briefing_generation_jobs SET updated_at=now()
    WHERE organization_id=$1 AND owner_user_id=$2 AND agent_id=$3 AND summary_id=$4`,
    [work.organizationId,work.userId,work.agentId,work.manifestId]);
}
