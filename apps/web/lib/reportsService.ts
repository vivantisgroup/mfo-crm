import { firebaseApp } from '@mfo-crm/config';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';

const db = getFirestore(firebaseApp);

export type ChartType = 
  | 'bar' | 'bar_stacked' | 'bar_horizontal' | 'waterfall'
  | 'line' | 'area' | 'candlestick'
  | 'pie' | 'doughnut' | 'rose' | 'treemap' | 'sunburst'
  | 'scatter' | 'bubble' | 'radar' 
  | 'funnel' | 'heatmap' | 'gauge';

export interface WidgetDefinition {
  id: string;
  type: ChartType;
  dataSource: string;
  title: string;
  theme: string;
  xKey?: string;
  yKey?: string;
  x?: number; // Grid X axis index
  y?: number; // Grid Y axis index
  w: number; // width span
  h: number; // height span
  
  // Advanced Visual Attributes
  showLegend?: boolean;
  showLabels?: boolean;
  isStacked?: boolean;
  smoothCurve?: boolean;
  animationType?: string;
  kpiTarget?: number;
}

export interface ReportDefinition {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  widgets: WidgetDefinition[];
  isPublished: boolean;
  theme: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export async function saveReport(report: ReportDefinition): Promise<void> {
  const ref = doc(db, 'reports', report.id);
  await setDoc(ref, report);
}

export async function getReports(tenantId: string): Promise<ReportDefinition[]> {
  const q = query(collection(db, 'reports'), where('tenantId', '==', tenantId));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as ReportDefinition)
    .sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getReportById(id: string): Promise<ReportDefinition | null> {
  const snap = await getDoc(doc(db, 'reports', id));
  if (!snap.exists()) return null;
  return snap.data() as ReportDefinition;
}

export async function deleteReport(id: string): Promise<void> {
  await deleteDoc(doc(db, 'reports', id));
}

export function createNewReport(tenantId: string, userId: string): ReportDefinition {
  return {
    id: 'rpt_' + Math.random().toString(36).substring(2, 11),
    tenantId,
    name: 'Untitled Dashboard',
    description: '',
    widgets: [],
    isPublished: false,
    theme: 'emerald',
    createdAt: new Date().toISOString(),
    createdBy: userId,
    updatedAt: new Date().toISOString(),
  };
}
