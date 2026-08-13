declare module "@handrail/mcp/client" {
  export class HandrailClient {
    constructor(options?: Record<string, unknown>, env?: Record<string, string | undefined>);
    discover(): Promise<any>;
    submit(input: Record<string, unknown>): Promise<any>;
    list(input?: Record<string, unknown>): Promise<any>;
    lookup(input: { request_id: string }): Promise<any>;
    releaseStatus(input: { request_id: string }): Promise<any>;
    dismiss(input: { request_id: string }): Promise<any>;
    cancel(input: { request_id: string; reason?: string | null }): Promise<any>;
    downloadAttachment(input: { request_id: string; attachment_id: string }): Promise<{ data: Uint8Array; filename: string | null; mime_type: string; size_bytes: number }>;
  }
}
