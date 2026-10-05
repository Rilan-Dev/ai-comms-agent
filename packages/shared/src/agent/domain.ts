export type AgentStatus = "draft" | "active" | "paused" | "archived";
export type DeploymentEnvironment = "production" | "preview";
export type AgentEmailAccountRole = "primary" | "read_only" | "send_only";

export interface Agent { id:string; organizationId:string; name:string; slug:string; description:string|null; status:AgentStatus; currentVersionId:string|null; currentDeploymentId:string|null; createdBy:string|null; createdAt:string; updatedAt:string; }
export interface AgentVersion { id:string; agentId:string; versionNumber:number; config:Record<string, unknown>; createdBy:string|null; createdAt:string; diffFromPrevious:Record<string, unknown>|null; }
export interface AgentDeployment { id:string; agentId:string; versionId:string; environment:DeploymentEnvironment; deployedBy:string|null; deployedAt:string; retiredAt:string|null; }
export interface AgentPolicy { id:string; agentId:string; securityPolicy:Record<string, unknown>; allowedTools:string[]; allowedSenders:string[]; blockedSenders:string[]; rateLimits:Record<string, unknown>; createdAt:string; updatedAt:string; }
export interface AgentEmailBinding { id:string; agentId:string; emailAccountId:string; role:AgentEmailAccountRole; createdAt:string; }
export interface AgentWhatsAppBinding { id:string; agentId:string; whatsappAccountId:string; createdAt:string; }
