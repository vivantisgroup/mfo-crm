import { db } from './firebase';
import { collection, query, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';

export interface ExpenseRule {
  id: string;
  field: 'amount' | 'category';
  operator: '>' | '<' | '==';
  value: string | number;
  actionRole: string; // The role that needs to approve this
}

export const executeExpenseRules = async (tenantId: string, expenseId: string, expenseData: any) => {
  // Fetch active rules
  const rulesRef = collection(db, 'tenants', tenantId, 'expense_rules');
  const snap = await getDocs(rulesRef);
  const rules = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExpenseRule));

  let requiredRole: string | null = null;

  // Evaluate rules
  for (const rule of rules) {
    let triggered = false;
    const expenseValue = expenseData[rule.field];

    if (rule.operator === '>') {
      triggered = Number(expenseValue) > Number(rule.value);
    } else if (rule.operator === '<') {
      triggered = Number(expenseValue) < Number(rule.value);
    } else if (rule.operator === '==') {
      triggered = expenseValue === rule.value;
    }

    if (triggered) {
      requiredRole = rule.actionRole;
      break; // For simplicity, first triggered rule overrides
    }
  }

  // Update expense status based on rules
  const expenseRef = doc(db, 'tenants', tenantId, 'expenses', expenseId);
  if (requiredRole) {
    await updateDoc(expenseRef, {
      status: 'pending_approval',
      pendingRole: requiredRole
    });
    // Fire mock notification
    console.log(`[Rule Engine] Routed Expense #${expenseId} to ${requiredRole} for approval.`);
  } else {
    // If no rules mandate approval, it auto-approves
    if (expenseData.status === 'submitted') {
      await updateDoc(expenseRef, {
        status: 'approved'
      });
      console.log(`[Rule Engine] Auto-approved Expense #${expenseId}.`);
    }
  }
};
