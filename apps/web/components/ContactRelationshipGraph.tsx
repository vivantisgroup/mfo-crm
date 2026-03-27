'use client';

/**
 * ContactRelationshipGraph
 *
 * A live-data adapter around RelationshipsTab.
 * Reads contacts, organizations, and contact_relationships from Firestore
 * and transforms them into NetworkNode[] / RelationshipEdge[] for the graph.
 *
 * Supports two focus modes:
 *  - focusContactId: show the selected contact + 1-hop neighbors
 *  - focusOrgId: show the selected org + its contacts
 *  - (neither): show the full tenant graph
 */

import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RelationshipsTab } from './RelationshipsTab';
import type { NetworkNode, RelationshipEdge } from '@/lib/types';

interface Props {
  tenantId:       string;
  focusContactId?: string;
  focusOrgId?:    string;
  familyId?:      string;   // show all contacts/orgs related to a family
}

interface FsContact {
  id:                string;
  firstName:         string;
  lastName:          string;
  role?:             string;
  linkedFamilyIds?:  string[];
  linkedOrgIds?:     string[];
}

interface FsOrg {
  id:                string;
  name:              string;
  type?:             string;
  linkedContactIds?: string[];
  linkedFamilyIds?:  string[];
}

interface FsRelationship {
  id:           string;
  fromId:       string;
  toId:         string;
  fromType:     string;   // 'contact' | 'organization'
  toType:       string;
  relationType: string;   // investor_in, managed_by, beneficiary_of, trustee_of, etc.
}

function toNetworkNode(item: FsContact | FsOrg, isContact: boolean): NetworkNode {
  if (isContact) {
    const c = item as FsContact;
    return {
      id:       `c-${c.id}`,
      name:     `${c.firstName} ${c.lastName}`,
      nodeType: 'member',
      subType:  c.role ? c.role.charAt(0).toUpperCase() + c.role.slice(1) : undefined,
      familyId: undefined,
    };
  }
  const o = item as FsOrg;
  return {
    id:       `o-${o.id}`,
    name:     o.name,
    nodeType: 'entity',
    subType:  o.type ? o.type.replace(/_/g, ' ') : undefined,
    familyId: undefined,
  };
}

function toRelEdge(rel: FsRelationship): RelationshipEdge {
  const srcId = rel.fromType === 'contact' ? `c-${rel.fromId}` : `o-${rel.fromId}`;
  const tgtId = rel.toType   === 'contact' ? `c-${rel.toId}`   : `o-${rel.toId}`;
  return {
    id:           `r-${rel.id}`,
    sourceId:     srcId,
    targetId:     tgtId,
    relationType: rel.relationType ?? 'related_to',
    weight:       1,
  };
}

export function ContactRelationshipGraph({ tenantId, focusContactId, focusOrgId, familyId }: Props) {
  const [contacts, setContacts] = useState<FsContact[]>([]);
  const [orgs,     setOrgs]     = useState<FsOrg[]>([]);
  const [rels,     setRels]     = useState<FsRelationship[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    Promise.all([
      getDocs(collection(db, 'tenants', tenantId, 'contacts')),
      getDocs(collection(db, 'tenants', tenantId, 'organizations')),
      getDocs(collection(db, 'tenants', tenantId, 'contact_relationships')),
    ]).then(([cSnap, oSnap, rSnap]) => {
      setContacts(cSnap.docs.map(d => ({ id: d.id, ...d.data() } as FsContact)));
      setOrgs(    oSnap.docs.map(d => ({ id: d.id, ...d.data() } as FsOrg)));
      setRels(    rSnap.docs.map(d => ({ id: d.id, ...d.data() } as FsRelationship)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [tenantId]);

  const { nodes, edges } = useMemo(() => {
    // Determine which IDs to include
    let includeContactIds = new Set(contacts.map(c => c.id));
    let includeOrgIds     = new Set(orgs.map(o => o.id));

    if (focusContactId) {
      // 1-hop: the focused contact + directly linked orgs
      const focusedContact = contacts.find(c => c.id === focusContactId);
      const linkedOrgIds   = new Set(focusedContact?.linkedOrgIds ?? []);
      includeContactIds    = new Set([focusContactId]);
      includeOrgIds        = linkedOrgIds;
      // also include contacts that share orgs with the focused one
      for (const c of contacts) {
        if (c.id === focusContactId) continue;
        if (c.linkedOrgIds?.some(oid => linkedOrgIds.has(oid))) includeContactIds.add(c.id);
      }
    } else if (focusOrgId) {
      const org = orgs.find(o => o.id === focusOrgId);
      includeOrgIds     = new Set([focusOrgId]);
      includeContactIds = new Set(org?.linkedContactIds ?? []);
    } else if (familyId) {
      includeContactIds = new Set(contacts.filter(c => c.linkedFamilyIds?.includes(familyId)).map(c => c.id));
      includeOrgIds     = new Set(orgs.filter(o => o.linkedFamilyIds?.includes(familyId)).map(o => o.id));
    }

    const nodes: NetworkNode[] = [
      ...contacts.filter(c => includeContactIds.has(c.id)).map(c => toNetworkNode(c, true)),
      ...orgs.filter(o => includeOrgIds.has(o.id)).map(o => toNetworkNode(o, false)),
    ];

    const allowedIds = new Set(nodes.map(n => n.id));

    // Also build implicit edges from org membership (linkedContactIds)
    const implicitEdges: RelationshipEdge[] = [];
    for (const org of orgs.filter(o => includeOrgIds.has(o.id))) {
      for (const cId of org.linkedContactIds ?? []) {
        if (includeContactIds.has(cId)) {
          implicitEdges.push({
            id:           `imp-${cId}-${org.id}`,
            sourceId:     `c-${cId}`,
            targetId:     `o-${org.id}`,
            relationType: 'member_of',
            weight:       1,
          });
        }
      }
    }

    // Explicit relationship edges
    const explicitEdges = rels
      .filter(r => {
        const src = r.fromType === 'contact' ? `c-${r.fromId}` : `o-${r.fromId}`;
        const tgt = r.toType   === 'contact' ? `c-${r.toId}`   : `o-${r.toId}`;
        return allowedIds.has(src) && allowedIds.has(tgt);
      })
      .map(toRelEdge);

    // Deduplicate
    const edgeMap = new Map<string, RelationshipEdge>();
    for (const e of [...implicitEdges, ...explicitEdges]) {
      const key = `${e.sourceId}→${e.targetId}`;
      if (!edgeMap.has(key)) edgeMap.set(key, e);
    }

    // Add a synthetic root node so RelationshipsTab has something to anchor to
    if (nodes.length > 0 && !nodes.find(n => n.nodeType === 'family')) {
      nodes.unshift({
        id:       `root-${tenantId}`,
        name:     focusContactId
          ? `${contacts.find(c => c.id === focusContactId)?.firstName ?? ''}'s Network`
          : focusOrgId
          ? orgs.find(o => o.id === focusOrgId)?.name ?? 'Organization'
          : 'Contact Network',
        nodeType: 'family',
        familyId: `root-${tenantId}`,
      });
      // Connect all top-level contacts/orgs to the root
      for (const n of nodes.slice(1)) {
        const key = `root-${tenantId}→${n.id}`;
        if (!edgeMap.has(key)) {
          edgeMap.set(key, { id: key, sourceId: `root-${tenantId}`, targetId: n.id, relationType: 'member', weight: 1 });
        }
      }
    }

    return { nodes, edges: Array.from(edgeMap.values()) };
  }, [contacts, orgs, rels, focusContactId, focusOrgId, familyId, tenantId]);

  if (loading) {
    return (
      <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--brand-500)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          Loading relationship graph…
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-tertiary)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-xl)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No relationships yet</div>
        <div style={{ fontSize: 13 }}>Add contacts and organizations, then link them to see the graph.</div>
      </div>
    );
  }

  return (
    <RelationshipsTab
      nodes={nodes}
      edges={edges}
      familyId={`root-${tenantId}`}
    />
  );
}
