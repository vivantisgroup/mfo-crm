import { collection, query, orderBy, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

export type EmploymentType = 'Full-Time' | 'Contractor';
export type DepartmentName = 'Executive' | 'Sales' | 'Engineering' | 'Operations' | 'Marketing' | 'HR' | 'Finance';

export interface Employee {
  id: string;
  name: string;
  title: string;
  department: DepartmentName;
  employmentType: EmploymentType;
  managerName?: string;
  baseSalary: number; // Annual
  quota?: number;     // Target ARR quota (sales)
  location: string;
  startDate: string;
  avatarUrl?: string;
}

export interface Department {
  id: string;
  name: string;
  headCfo?: string;
  annualBudget?: number;
}

export interface DepartmentMetric {
  name: DepartmentName;
  headcount: number;
  totalAnnualBase: number;
  avgSalary: number;
}

export interface CommissionRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  dealName: string;
  dealValueUsd: number;
  commissionAmount: number; // Resulting payout
  timestamp: string; // ISO
  status: 'pending' | 'paid';
}

export interface PayRun {
  id: string;
  period: string; // e.g. 'Oct 2024'
  status: 'draft' | 'approved' | 'paid';
  totalBaseSalaries: number;
  totalCommissions: number;
  totalTaxes: number;
  netPayout: number;
  runDate: string; // ISO
}

// ─── API Services ─────────────────────────────────────────────────────────────

export async function getEmployees(): Promise<Employee[]> {
  try {
    const q = query(collection(db, 'platform_people'), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
  } catch(e) {
    console.warn("Failed fetching people", e);
    return [];
  }
}

export async function addEmployee(entry: Omit<Employee, 'id'>): Promise<Employee> {
  const docRef = await addDoc(collection(db, 'platform_people'), entry);
  return { id: docRef.id, ...entry };
}
export async function updateEmployee(id: string, updates: Partial<Omit<Employee, 'id'>>): Promise<void> {
  const docRef = doc(db, 'platform_people', id);
  await updateDoc(docRef, updates);
}


// ─── Departments ─────────────────────────────────────────────────────────────

export async function getDepartments(): Promise<Department[]> {
  try {
    const q = query(collection(db, 'platform_departments'), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Department));
  } catch(e) {
    console.warn("Failed fetching departments", e);
    return [];
  }
}

export async function addDepartment(entry: Omit<Department, 'id'>): Promise<Department> {
  const docRef = await addDoc(collection(db, 'platform_departments'), entry);
  return { id: docRef.id, ...entry };
}

export async function updateDepartment(id: string, updates: Partial<Omit<Department, 'id'>>): Promise<void> {
  const docRef = doc(db, 'platform_departments', id);
  await updateDoc(docRef, updates);
}

export async function deleteDepartment(id: string): Promise<void> {
  const docRef = doc(db, 'platform_departments', id);
  await deleteDoc(docRef);
}

// ─── Commissions ─────────────────────────────────────────────────────────────

export async function getCommissions(): Promise<CommissionRecord[]> {
  try {
    const q = query(collection(db, 'hr_commissions'), orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CommissionRecord));
  } catch(e) {
    console.warn("Failed fetching commissions", e);
    return [];
  }
}

export async function addCommission(entry: Omit<CommissionRecord, 'id'>): Promise<CommissionRecord> {
  const docRef = await addDoc(collection(db, 'hr_commissions'), entry);
  return { id: docRef.id, ...entry };
}

export async function getPayruns(): Promise<PayRun[]> {
  try {
    const q = query(collection(db, 'hr_payruns'), orderBy('period', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PayRun));
  } catch(e) {
    console.warn("Failed fetching payruns", e);
    return [];
  }
}

export async function addPayrun(entry: Omit<PayRun, 'id'>): Promise<PayRun> {
  const docRef = await addDoc(collection(db, 'hr_payruns'), entry);
  return { id: docRef.id, ...entry };
}

export async function updatePayrunStatus(id: string, status: PayRun['status']): Promise<void> {
  const docRef = doc(db, 'hr_payruns', id);
  await updateDoc(docRef, { status });
}

export async function updateCommissionStatus(id: string, status: CommissionRecord['status']): Promise<void> {
  const docRef = doc(db, 'hr_commissions', id);
  await updateDoc(docRef, { status });
}

