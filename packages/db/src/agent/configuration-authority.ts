import {ForbiddenError,SYSTEM_ROLE_PERMISSIONS,type ConfigurationDiff,type MembershipRole,type PermissionName} from '@ai-comms-agent/shared';
import type {PoolClient} from 'pg';
import type {AgentConfigurationScope} from './configuration-revisions';

export type ConfigurationActor={id:string;role:MembershipRole;permissions:ReadonlySet<PermissionName>};

/** Hold current user/membership grants through the transaction. Sorted actor
 * locks keep an owner applying another editor's draft from deadlocking with
 * another apply. This is the same Option-A role map as web authorization. */
export async function lockConfigurationActors(client:PoolClient,scope:AgentConfigurationScope,userIds:readonly (string|null)[]):Promise<Map<string,ConfigurationActor>>{
 if(userIds.some(id=>!id))throw new ForbiddenError('missing_permission','The original editor is unavailable. Save the visible changes as your own new draft.');
 const result=await client.query<{id:string;role:MembershipRole;user_status:string;membership_status:string}>(`SELECT u.id,u.status AS user_status,m.role,m.status AS membership_status FROM users u
  JOIN organization_memberships m ON m.user_id=u.id AND m.organization_id=$1
  WHERE u.id=ANY($2::uuid[]) ORDER BY u.id FOR SHARE OF u,m`,[scope.organizationId,[...new Set(userIds)].sort()]);
 const actors=new Map<string,ConfigurationActor>();
 for(const row of result.rows){if(row.user_status==='active'&&row.membership_status==='active'&&Object.hasOwn(SYSTEM_ROLE_PERMISSIONS,row.role))actors.set(row.id,{id:row.id,role:row.role,permissions:new Set(SYSTEM_ROLE_PERMISSIONS[row.role])});}
 if(userIds.some(id=>!actors.has(id!)))throw new ForbiddenError('missing_permission','Current access for the editor or applying user is no longer available.');
 return actors;
}

export function assertConfigurationOwner(actor:ConfigurationActor):void{if(actor.role!=='owner')throw new ForbiddenError('insufficient_role','An organization owner must review and apply deployment changes.');}
export function assertConfigurationChangeAuthority(actor:ConfigurationActor,diff:ConfigurationDiff):void{
 const rank={viewer:0,member:1,admin:2,owner:3};
 if(rank[actor.role]<rank.admin)throw new ForbiddenError('insufficient_role','An administrator must save configuration changes.');
 for(const change of diff){
  const [section,field]=change.path;
  if(section==='lifecycle'){assertConfigurationOwner(actor);continue;}
  if(section==='ai'||(section==='legacy'&&field!=='version')){
   if(!actor.permissions.has('organization.update'))throw new ForbiddenError('missing_permission','Current organization-update permission is required for AI settings.');
  }else if(rank[actor.role]<rank.admin)throw new ForbiddenError('insufficient_role','An administrator must save these configuration changes.');
 }
}
