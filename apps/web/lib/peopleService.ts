export interface Employee {
  id: string;
  name: string;
  title: string;
  department: 'Executive' | 'Sales' | 'Engineering' | 'Operations' | 'Marketing';
  employmentType: 'Full-Time' | 'Contractor';
  managerName?: string;
  baseSalary: number;
  quota?: number;          // Target ARR quota (primarily for sales)
  ytdCommission?: number;  // Commission earned year-to-date
  location: string;
  startDate: string;
  avatarUrl?: string;
  linkedContactId?: string;
  linkedMemberUid?: string;
}

let localEmployees: Employee[] = [
  { id: 'emp-1', name: 'Alice CEO', title: 'Chief Executive Officer', department: 'Executive', employmentType: 'Full-Time', baseSalary: 250000, location: 'London', startDate: '2022-01-15' },
  { id: 'emp-2', name: 'Jane Smith', title: 'Director of EMEA Sales', department: 'Sales', employmentType: 'Full-Time', managerName: 'Alice CEO', baseSalary: 140000, quota: 2500000, ytdCommission: 45000, location: 'London', startDate: '2023-03-01' },
  { id: 'emp-3', name: 'Carlos Mendoza', title: 'Senior Account Executive', department: 'Sales', employmentType: 'Full-Time', managerName: 'Jane Smith', baseSalary: 95000, quota: 1200000, ytdCommission: 62000, location: 'Madrid', startDate: '2024-02-10' },
  { id: 'emp-4', name: 'Sarah Chen', title: 'Lead Software Engineer', department: 'Engineering', employmentType: 'Full-Time', managerName: 'Alice CEO', baseSalary: 165000, location: 'Remote (US)', startDate: '2023-08-01' },
  { id: 'emp-5', name: 'David Lee', title: 'Operations Specialist', department: 'Operations', employmentType: 'Contractor', managerName: 'Alice CEO', baseSalary: 85000, location: 'Toronto', startDate: '2024-11-20' },
];

import { collection, query, orderBy, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function getEmployees(): Promise<Employee[]> {
  const q = query(collection(db, 'platform_people'), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  if (snap.empty) return localEmployees.sort((a,b) => a.name.localeCompare(b.name));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
}

export async function addEmployee(entry: Omit<Employee, 'id'>): Promise<Employee> {
  const docRef = await addDoc(collection(db, 'platform_people'), entry);
  return { id: docRef.id, ...entry };
}

export async function updateEmployee(id: string, updates: Partial<Employee>): Promise<void> {
  const dRef = doc(db, 'platform_people', id);
  await updateDoc(dRef, updates as any);
}
