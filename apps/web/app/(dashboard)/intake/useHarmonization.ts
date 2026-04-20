import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';

export type HarmonizationRule = {
    id: string;
    rawText: string;
    normalizedName: string;
    category: 'institution' | 'asset_ticker' | 'currency';
};

export function useHarmonization() {
    const { tenant } = useAuth();
    const [rules, setRules] = useState<HarmonizationRule[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!tenant?.id) return;
        const colRef = collection(db, 'tenants', tenant.id, 'harmonizationDictionary');
        
        const unsub = onSnapshot(colRef, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as HarmonizationRule));
            setRules(data);
            setLoading(false);
        });

        return unsub;
    }, [tenant?.id]);

    const addRule = async (rule: Omit<HarmonizationRule, 'id'>) => {
        if (!tenant?.id) return;
        // Using rawText hashed or just random UUID
        const id = crypto.randomUUID();
        const ref = doc(db, 'tenants', tenant.id, 'harmonizationDictionary', id);
        await setDoc(ref, { id, ...rule, createdAt: new Date() });
    };

    const deleteRule = async (id: string) => {
        if (!tenant?.id) return;
        const ref = doc(db, 'tenants', tenant.id, 'harmonizationDictionary', id);
        await deleteDoc(ref);
    };

    const harmonize = (rawText: string, category?: HarmonizationRule['category']) => {
        const cleanRaw = rawText.toLowerCase().replace(/\s+/g, '');
        const match = rules.find(r => 
            r.rawText.toLowerCase().replace(/\s+/g, '') === cleanRaw && 
            (!category || r.category === category)
        );
        return match; // returns the full rule if matched, else undefined
    };

    return { rules, loading, addRule, deleteRule, harmonize };
}
