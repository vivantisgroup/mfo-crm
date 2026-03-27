import { NextRequest, NextResponse } from 'next/server';
import {
  getFirestore, collection, doc, setDoc, addDoc, writeBatch,
} from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';

const db = getFirestore(firebaseApp);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { backup, tenantId, dryRun = false } = body as {
      backup: Record<string, Array<{ _id: string; [key: string]: any }>>;
      tenantId?: string;
      dryRun?: boolean;
    };

    if (!backup || typeof backup !== 'object') {
      return NextResponse.json({ error: 'backup payload required' }, { status: 400 });
    }

    const report: Array<{ collection: string; docsWritten: number; docsSkipped: number }> = [];
    let totalWritten = 0;

    if (!dryRun) {
      for (const [colName, docs] of Object.entries(backup)) {
        let written = 0, skipped = 0;
        for (const docData of docs) {
          const { _id, ...fields } = docData;
          // Filter by tenant if tenantId provided
          if (tenantId && fields.tenantId && fields.tenantId !== tenantId) {
            skipped++;
            continue;
          }
          if (!_id) { skipped++; continue; }
          try {
            await setDoc(doc(db, colName, _id), { ...fields, importedAt: new Date().toISOString() }, { merge: true });
            written++;
          } catch {
            skipped++;
          }
        }
        totalWritten += written;
        report.push({ collection: colName, docsWritten: written, docsSkipped: skipped });
      }
    } else {
      // Dry run — just count
      for (const [colName, docs] of Object.entries(backup)) {
        report.push({ collection: colName, docsWritten: docs.length, docsSkipped: 0 });
        totalWritten += docs.length;
      }
    }

    // Audit
    if (!dryRun) {
      await addDoc(collection(db, 'audit_logs'), {
        tenantId: tenantId ?? 'master', userId: 'backup_restore', userName: 'Backup Manager',
        action: 'BACKUP_IMPORT', resourceId: tenantId ?? 'platform',
        resourceType: 'backup', resourceName: `Import — ${totalWritten} docs`,
        status: 'success', ipAddress: 'server', userAgent: 'Backup Management UI',
        occurredAt: new Date().toISOString(),
      }).catch(() => {});
    }

    return NextResponse.json({ dryRun, totalWritten, report });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
