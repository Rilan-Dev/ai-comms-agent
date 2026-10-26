import {NextResponse} from 'next/server';

/** Call only after the original endpoint's authentication/authority check.
 * The old wire contract has no immutable base/draft/review receipt. Never
 * invent one by reading a newer state on behalf of a stale form. */
export function requireConfigurationWorkflow(){
 if(process.env.AGENT_CONFIGURATION_REVISIONS_ENABLED!=='true')return null;
 return NextResponse.json({error:'configuration_workflow_required',message:'Open this agent’s settings, save your choices as a draft, then review and apply them. To remove access immediately, use Revoke access or Pause.'},{status:409,headers:{'cache-control':'private, no-store'}});
}
