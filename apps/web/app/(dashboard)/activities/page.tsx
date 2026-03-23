'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { getLiveActivities, seedFirestore } from '@/lib/firebase';
import { ActivityItem } from '@/components/ActivityItem';
import { Activity } from '@/lib/types';
import { useTranslation } from '@/lib/i18n/context';

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const { t } = useTranslation();
  
  const [search, setSearch] = useState('');
  const [familyFilter, setFamilyFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [sentimentFilter, setSentimentFilter] = useState('All');

  const tenant = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('mfo_active_tenant') || '{}') : {};

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      if (tenant?.id) {
        const data = await getLiveActivities(tenant.id);
        setActivities(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSeed() {
    if (!tenant?.id) return;
    setSeeding(true);
    try {
      await seedFirestore(tenant.id);
      await fetchData();
    } catch (e) {
      console.error(e);
      alert('Failed to seed database. Is Firestore configured?');
    } finally {
      setSeeding(false);
    }
  }

  const filteredActivities = useMemo(() => {
    return activities.filter(act => {
      // Search
      const textMatches = search === '' || 
        act.subject.toLowerCase().includes(search.toLowerCase()) || 
        (act.summaryAi && act.summaryAi.toLowerCase().includes(search.toLowerCase()));
      
      // Family
      const familyMatches = familyFilter === 'All' || act.familyName === familyFilter;
      
      // Type
      const typeMatches = typeFilter === 'All' || act.activityType === typeFilter.toLowerCase();
      
      // Sentiment
      let sentimentMatches = true;
      if (sentimentFilter === 'Urgent') {
        sentimentMatches = act.sentiment === 'urgent';
      } else if (sentimentFilter !== 'All') {
        sentimentMatches = act.sentiment === sentimentFilter.toLowerCase();
      }

      return textMatches && familyMatches && typeMatches && sentimentMatches;
    });
  }, [activities, search, familyFilter, typeFilter, sentimentFilter]);

  return (
    <div className="page animate-fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 32, letterSpacing: '-0.03em' }}>
            {t('page.activities.title')}
          </h1>
          <p className="page-subtitle" style={{ fontSize: 15, marginTop: 8 }}>
            {t('page.activities.subtitle')}
            {!loading && activities.length > 0 && <span style={{ marginLeft: 8, padding: '2px 8px', background: 'var(--brand-900)', color: 'var(--brand-300)', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{activities.length} LIVE</span>}
          </p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary">{t('page.activities.sync')}</button>
          <button className="btn btn-primary">{t('page.activities.log')}</button>
        </div>
      </div>

      {/* Premium Filter Dashboard */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-input-wrap" style={{ flex: 1, minWidth: 280, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 14, top: 12, color: 'var(--text-tertiary)' }}>🔍</span>
          <input 
            type="text" 
            placeholder="Search through intelligence..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ 
              width: '100%', padding: '12px 16px 12px 40px', borderRadius: 'var(--radius-lg)', 
              background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)', transition: 'all 0.2s', fontSize: 14
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, background: 'var(--bg-elevated)', padding: 6, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <select 
            value={familyFilter} 
            onChange={e => setFamilyFilter(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', padding: '6px 12px', fontSize: 14, outline: 'none', cursor: 'pointer' }}
          >
            <option value="All">Global Views</option>
            <option value="Smith Family">Smith Family</option>
            <option value="Rodríguez Family">Rodríguez Family</option>
            <option value="Chen Family">Chen Family</option>
          </select>

          <div style={{ width: 1, background: 'var(--border)', margin: '4px 0' }} />

          <select 
            value={typeFilter} 
            onChange={e => setTypeFilter(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', padding: '6px 12px', fontSize: 14, outline: 'none', cursor: 'pointer' }}
          >
            <option value="All">All Types</option>
            <option value="Email">Emails</option>
            <option value="Call">📞 Calls</option>
            <option value="Meeting">🤝 Meetings</option>
            <option value="Note">📝 Notes</option>
          </select>

          <div style={{ width: 1, background: 'var(--border)', margin: '4px 0' }} />

          <select 
            value={sentimentFilter} 
            onChange={e => setSentimentFilter(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: sentimentFilter === 'All' ? 'var(--text-primary)' : 'var(--brand-400)', padding: '6px 12px', fontSize: 14, outline: 'none', cursor: 'pointer', fontWeight: sentimentFilter !== 'All' ? 600 : 400 }}
          >
            <option value="All">Sentiment</option>
            <option value="Urgent">⚠️ Urgent</option>
            <option value="Positive">📈 Positive</option>
            <option value="Neutral">⚪ Neutral</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
        <div className="card" style={{ padding: '0', background: 'transparent', border: 'none', boxShadow: 'none' }}>
          <div className="activity-list" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {loading ? (
              <div className="empty-state" style={{ padding: '80px 0', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}>
                <div className="empty-state-icon" style={{ animation: 'spin 1.5s linear infinite', borderTopColor: 'var(--brand-500)', borderRightColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: 'transparent', borderRadius: '50%', borderStyle: 'solid', borderWidth: 3, width: 32, height: 32, background: 'transparent' }}></div>
                <div className="empty-state-title" style={{ marginTop: 16 }}>Connecting to Nexus Core...</div>
                <div className="text-secondary text-sm mt-2">Authenticating workspace keys</div>
              </div>
            ) : activities.length === 0 ? (
              <div className="empty-state" style={{ padding: '80px 0', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
                <div className="empty-state-icon" style={{ fontSize: 48, filter: 'drop-shadow(0 0 20px rgba(0,118,255,0.4))' }}>⚡</div>
                <div className="empty-state-title" style={{ fontSize: 24 }}>Workspace is Empty</div>
                <div className="text-secondary text-sm mt-2 mb-6" style={{ maxWidth: 400, margin: '8px auto 24px' }}>
                  The live Firestore database connection has been established successfully, but {tenant.name || 'this workspace'} currently has no ingested data.
                </div>
                <button className="btn btn-primary" onClick={handleSeed} disabled={seeding} style={{ padding: '12px 24px', fontSize: 15 }}>
                  {seeding ? 'Ingesting Simulation Data...' : 'Execute Demo Data Seeder'}
                </button>
              </div>
            ) : filteredActivities.length > 0 ? (
              filteredActivities.map(act => (
                <div key={act.id} style={{ 
                  background: 'var(--bg-elevated)', borderRadius: 'var(--radius-xl)', 
                  border: '1px solid var(--border)', overflow: 'hidden', 
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)', transition: 'transform 0.2s, box-shadow 0.2s' 
                }}
                  className="hover-lift"
                >
                  <ActivityItem activity={act} />
                </div>
              ))
            ) : (
              <div className="empty-state" style={{ padding: '80px 0', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}>
                <div className="empty-state-icon" style={{ opacity: 0.5 }}>📭</div>
                <div className="empty-state-title">{t('page.activities.empty')}</div>
                <div className="text-secondary text-sm mt-2">{t('page.activities.empty_hint')}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
