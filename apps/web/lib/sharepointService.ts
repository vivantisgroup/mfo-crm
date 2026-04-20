// Placeholder for MSAL (Microsoft Authentication Library) or Graph API Client
// import { Client } from '@microsoft/microsoft-graph-client';

export interface SharepointDocument {
  id: string;
  name: string;
  url: string;
  downloadUrl: string;
}

export class SharepointService {
  private tenantId: string;
  
  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Mocks authenticating with Azure AD Service Principal to connect to MS Graph.
   */
  async getClient() {
    // const client = Client.init({ authProvider: ... });
    // return client;
    return null;
  }

  /**
   * Fetches the latest unprocessed PDF documents from the tenant's OneDrive/Sharepoint folder.
   */
  async fetchUnprocessedDocuments(folderPath: string = '/Accounting/Inbox'): Promise<SharepointDocument[]> {
    console.log(`[SharepointService] Fetching documents from ${folderPath} for tenant ${this.tenantId}`);
    
    // MOCK RESPONSES FOR SAAS ARCHITECTURE
    // In production, this runs:
    // await client.api(`/sites/{site-id}/drive/root:${folderPath}:/children`).get();
    
    return [
      {
        id: 'doc-mock-1',
        name: 'Extrato_Itau_Janeiro_2026.pdf',
        url: 'https://mfo-crm.sharepoint.com/doc-mock-1',
        downloadUrl: 'https://mfo-crm.sharepoint.com/downloads/doc-mock-1'
      },
      {
        id: 'doc-mock-2',
        name: 'Capital_Call_Sequoia_Q1.pdf',
        url: 'https://mfo-crm.sharepoint.com/doc-mock-2',
        downloadUrl: 'https://mfo-crm.sharepoint.com/downloads/doc-mock-2'
      }
    ];
  }

  /**
   * Moves a processed document to an archive folder so the CRON doesn't process it next month.
   */
  async archiveDocument(fileId: string, archivePath: string = '/Accounting/Processed') {
    console.log(`[SharepointService] Moved ${fileId} to ${archivePath}`);
    // client.api(`/drives/{drive-id}/items/${fileId}`).patch({ parentReference: { path: archivePath } })
    return true;
  }
}
