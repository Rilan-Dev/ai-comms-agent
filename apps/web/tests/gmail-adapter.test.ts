import { describe, expect, it, vi, afterEach } from "vitest";
import { GmailAdapter } from "../../../apps/worker/src/email/gmail-adapter";
import { listEmailToolDescriptors } from "../../../packages/shared/src/agent/mail-operations";

describe("GmailAdapter", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it('reconciles read flags through metadata without fetching full mail bodies',async()=>{
    const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(Response.json({historyId:'100'}))
      .mockResolvedValueOnce(Response.json({id:'message-1',labelIds:['UNREAD','STARRED'],payload:{headers:[{name:'Message-ID',value:'<one@test>'}]}}));
    const adapter=new GmailAdapter();await adapter.connect({credential_type:'oauth_token',access_token:'fixture-token'});
    const flags=await (adapter as unknown as {getMessageFlags:(ids:string[])=>Promise<unknown[]>}).getMessageFlags(['message-1']);
    expect(flags).toEqual([{provider_message_id:'message-1',message_id_header:'<one@test>',is_read:false,is_starred:true,is_draft:false,is_outbound:false}]);
    const url=new URL(String(fetch.mock.calls[1]![0]));expect(url.searchParams.get('format')).toBe('metadata');expect(url.searchParams.get('fields')).not.toContain('body');
  });
  it('distinguishes confirmed Gmail deletion from a transport error during flag reconciliation',async()=>{
    vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(Response.json({historyId:'100'}))
      .mockResolvedValueOnce(new Response('Not found',{status:404})).mockRejectedValueOnce(new Error('Network unavailable'));
    const adapter=new GmailAdapter();await adapter.connect({credential_type:'oauth_token',access_token:'fixture-token'});
    const metadata=adapter as unknown as {getMessageFlags:(ids:string[])=>Promise<unknown[]>};
    expect(await metadata.getMessageFlags(['gone'])).toEqual([]);
    await expect(metadata.getMessageFlags(['retry'])).rejects.toThrow('Network unavailable');
  });

  it("returns refreshed credentials using the shared EmailCredentials contract", async () => {
    const adapter = new GmailAdapter();
    vi.spyOn(globalThis,"fetch").mockResolvedValue(Response.json({historyId:"fixture-history"}));
    await adapter.connect({ credential_type: "oauth_token", access_token: "test-token", refresh_token: "refresh-token",oauth_client_id:"fixture-client",oauth_client_secret:"fixture-secret" });
    expect(adapter.getCredentialSnapshot()).toMatchObject({
      credential_type: "oauth_token",
      access_token: "test-token",
      refresh_token: "refresh-token",
    });
  });

  it("paginates initial sync and retains the history baseline until import completes", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ historyId: "connect-history" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ historyId: "baseline-history" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ messages: [{ id: "message-1" }], nextPageToken: "page-2" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ messages: [{ id: "message-2" }] }), { status: 200 }));
    const adapter = new GmailAdapter();
    await adapter.connect({ credential_type: "oauth_token", access_token: "test-token" });

    const first = await adapter.sync({ sync_mode: "initial", last_sync_at: new Date(0).toISOString() });
    expect(first.added.map((item) => item.provider_message_id)).toEqual(["message-1"]);
    expect(first.new_state).toMatchObject({ cursor: "page-2", history_token: "baseline-history", sync_mode: "initial" });

    const second = await adapter.sync(first.new_state);
    expect(second.added.map((item) => item.provider_message_id)).toEqual(["message-2"]);
    expect(second.new_state).toMatchObject({ history_token: "baseline-history", sync_mode: "incremental" });
    expect(second.new_state.cursor).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("extracts readable text from HTML-only Gmail messages", async () => {
    const html = "<html><head><style>.hidden{display:none}</style></head><body><p>Draft details</p><script>unsafe()</script><div>Second line</div></body></html>";
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ historyId: "123" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "message-1",
        threadId: "thread-1",
        internalDate: String(Date.now()),
        labelIds: ["DRAFT"],
        snippet: "short snippet",
        payload: {
          mimeType: "text/html",
          headers: [{ name: "Subject", value: "Draft subject" }, { name: "From", value: "sender@example.com" }],
          body: { data: Buffer.from(html).toString("base64url") },
        },
      }), { status: 200 }));
    const adapter = new GmailAdapter();
    await adapter.connect({ credential_type: "oauth_token", access_token: "test-token" });
    const message = await adapter.getMessage("message-1");
    expect(message?.is_draft).toBe(true);
    expect(message?.text_body).toContain("Draft details");
    expect(message?.text_body).toContain("Second line");
    expect(message?.text_body).not.toContain("unsafe()");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("advertises the provider capability matrix", () => {
    const adapter = new GmailAdapter();
    const capabilities = adapter.capabilities();
    expect(capabilities.folders).toBe(true);
    expect(capabilities.sync_webhook).toBe(false);
    expect(capabilities.sync_idle).toBe(false);
    expect(capabilities.send).toBe(true);
    expect(capabilities.attachments_upload).toBe(false);
  });

  it("requires an OAuth access token", async () => {
    const adapter = new GmailAdapter();
    await expect(adapter.connect({ credential_type: "oauth_token" })).rejects.toThrow(/access token/);
  });

  it("uses the OAuth token for API calls", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ historyId: "123" }), { status: 200 }),
    );
    const adapter = new GmailAdapter();
    await adapter.connect({ credential_type: "oauth_token", access_token: "test-token" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }),
    );
  });
  it("refreshes an expired access token before API calls", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "fresh-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ historyId: "123" }), { status: 200 }));
    const adapter = new GmailAdapter();
    await adapter.connect({
      credential_type: "oauth_token",
      access_token: "expired-token",
      refresh_token: "refresh-token",
      oauth_client_id: "client-id",
      oauth_client_secret: "client-secret",
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST", body: expect.any(URLSearchParams) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer fresh-token" }) }),
    );
    expect(adapter.getCredentialSnapshot()).toMatchObject({
      access_token: "fresh-token",
      refresh_token: "refresh-token",
      oauth_client_id: "client-id",
    });
    expect(adapter.getCredentialSnapshot().expires_at).toEqual(expect.any(String));
  });

  it("refreshes once after an unauthorized API response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("expired", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "fresh-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ historyId: "123" }), { status: 200 }));
    const adapter = new GmailAdapter();
    await adapter.connect({
      credential_type: "oauth_token",
      access_token: "expired-token",
      refresh_token: "refresh-token",
      oauth_client_id: "client-id",
      oauth_client_secret: "client-secret",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer fresh-token" }) }),
    );
  });


  it("paginates history and reports additions, label changes, and deletions", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ historyId: "connected" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        historyId: "110", nextPageToken: "p2",
        history: [
          { messagesAdded: [{ message: { id: "added-1" } }] },
          { labelsAdded: [{ message: { id: "updated-1" } }] },
          { messagesDeleted: [{ message: { id: "deleted-1" } }] },
        ],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        historyId: "120", history: [{ messagesAdded: [{ message: { id: "added-2" } }] }],
      }), { status: 200 }));
    const adapter = new GmailAdapter();
    await adapter.connect({ credential_type: "oauth_token", access_token: "test-token" });
    const result = await adapter.sync({ sync_mode: "incremental", history_token: "100", last_sync_at: new Date(0).toISOString() });
    expect(result.added.map((m) => m.provider_message_id)).toEqual(["added-1", "added-2"]);
    expect(result.updated.map((m) => m.provider_message_id)).toEqual(["updated-1"]);
    expect(result.deleted).toEqual(["deleted-1"]);
    expect(result.new_state.history_token).toBe("120");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[2]?.[0] ?? "")).toContain("pageToken=p2");
  });

  it("filters email contracts by account capability", () => {
    const result = listEmailToolDescriptors({ folders: true, labels: false });
    expect(result.some((item) => item.name === "email.folders.list")).toBe(true);
    expect(result.some((item) => item.name === "email.labels.list")).toBe(false);
  });
});
