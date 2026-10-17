-- Feature-domain RBAC entry required by the host-authorized email read tool runtime.
INSERT INTO permissions (name, description)
VALUES ('email.read', 'Read connected email accounts and messages through agent tools')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;
