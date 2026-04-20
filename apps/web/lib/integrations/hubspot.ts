// apps/web/lib/integrations/hubspot.ts

export interface HubSpotContact {
  id: string;
  properties: {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    hs_notes?: string;
  };
}

export interface HubSpotCompany {
  id: string;
  properties: {
    name?: string;
    domain?: string;
    phone?: string;
    city?: string;
  };
}

export class HubspotService {
  constructor(private accessToken: string) {}

  async fetchContacts(): Promise<HubSpotContact[]> {
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,notes', {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    if (!res.ok) {
        let msg = res.statusText;
        try { msg = (await res.json()).message; } catch {}
        throw new Error(`HubSpot Contacts Error: ${res.status} ${msg}`);
    }
    const data = await res.json();
    return data.results || [];
  }

  async fetchCompanies(): Promise<HubSpotCompany[]> {
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/companies?limit=100&properties=name,domain,city,phone', {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    if (!res.ok) {
        let msg = res.statusText;
        try { msg = (await res.json()).message; } catch {}
        throw new Error(`HubSpot Companies Error: ${res.status} ${msg}`);
    }
    const data = await res.json();
    return data.results || [];
  }
}
