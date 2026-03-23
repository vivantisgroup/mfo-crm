import React from 'react';
import type { Activity } from '@/lib/types';
import { formatRelativeDate, getActivityIcon } from '@/lib/utils';

export function ActivityItem({ activity }: { activity: Activity }) {
  const icon = getActivityIcon(activity.activityType);
  const aiBadge = activity.summaryAi ? <span className="badge badge-brand ml-2 flex-shrink-0" style={{ marginLeft: 8 }}>AI Summary</span> : null;

  return (
    <div className="activity-item">
      <div className="activity-icon-wrap" title={activity.activityType}>{icon}</div>
      <div className="activity-body">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div className="activity-subject">{activity.subject}</div>
          <div className="activity-time">{formatRelativeDate(activity.occurredAt)}</div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span className="activity-family">{activity.familyName}</span>
          {/* Sentiment Badge */}
          {activity.sentiment === 'concern' && <span className="badge badge-warning">Concern</span>}
          {activity.sentiment === 'urgent' && <span className="badge badge-danger">Urgent</span>}
          {activity.sentiment === 'positive' && <span className="badge badge-success">Positive</span>}
          
          {/* AI Badge */}
          {aiBadge}
        </div>

        {/* Show snippet */}
        {(activity.summaryAi || activity.body) && (
          <div className="activity-summary">
            {activity.summaryAi || activity.body}
          </div>
        )}
      </div>
    </div>
  );
}
