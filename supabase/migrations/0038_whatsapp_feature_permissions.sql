-- Feature-domain RBAC entries for WhatsApp conversation access and send proposals.
INSERT INTO permissions (name, description)
VALUES
  ('whatsapp.read', 'Read connected WhatsApp conversations and approval requests'),
  ('whatsapp.send', 'Request WhatsApp outbound messages through human approval')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;
