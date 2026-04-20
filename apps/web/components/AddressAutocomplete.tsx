'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, MapPin, Building2, UserCircle2 } from 'lucide-react';

export interface InternalAddress {
  id: string;
  name: string;      // E.g. "Org Name - Invoice"
  type: string;      // E.g. "org" or "contact"
  addressObj: any;   // Standard address object
}

interface AddressAutocompleteProps {
  value: any;
  onSave: (addr: any) => void;
  canEdit?: boolean;
  internalAddresses?: InternalAddress[];
}

export function AddressAutocomplete({ value, onSave, canEdit = true, internalAddresses = [] }: AddressAutocompleteProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Address struct
  const defaultAddr = { street:'', number:'', complement:'', city:'', state:'', zip:'', country:'' };
  const [addr, setAddr] = useState<any>(value || defaultAddr);

  useEffect(() => {
    if (value) setAddr(value);
  }, [value]);

  const formatDisplay = (a: any) => {
     if (!a || !a.street) return null;
     const parts = [a.street, a.number, a.complement, a.city, a.state, a.country].filter(Boolean);
     return parts.join(', ');
  };

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q || q.length < 3) { setResults([]); return; }
    
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      
      let newResults: any[] = [];
      const qLower = q.toLowerCase();

      // 1. Internal CRM Database Matching
      if (internalAddresses && internalAddresses.length > 0) {
         const internalMatches = internalAddresses.filter(ia => {
             const str = [ia.addressObj.street, ia.addressObj.number, ia.addressObj.city, ia.name, ia.type].filter(Boolean).join(' ').toLowerCase();
             return str.includes(qLower);
         }).slice(0, 4); // Max 4 internal results
         
         internalMatches.forEach(im => {
            newResults.push({
               source: 'internal',
               internalType: im.type,
               name: im.name,
               display_name: formatDisplay(im.addressObj),
               addressObj: im.addressObj
            });
         });
      }

      // 2. Photon API Lookup (External)
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (apiKey) {
           const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&key=${apiKey}`);
           const data = await res.json();
           if (data.predictions) {
              data.predictions.forEach((p:any) => {
                 newResults.push({
                   place_id: p.place_id,
                   name: p.structured_formatting?.main_text || p.description,
                   display_name: p.description,
                   source: 'google'
                 });
              });
           }
        } else {
           // Photon open tier (much better for POI than Nominatim)
           const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6`);
           const data = await res.json();
           if (data.features) {
             data.features.forEach((f:any) => {
               const p = f.properties;
               const name = p.name || p.street || p.city;
               const displayLine = [p.street, p.housenumber, p.district, p.city, p.state, p.country].filter(Boolean).join(', ');
               
               newResults.push({
                 id: p.osm_id + Math.random(), // guarantee uniqueness in list
                 name: p.name || p.street || 'Address',
                 display_name: displayLine,
                 source: 'photon',
                 properties: p
               });
             });
           }
        }
      } catch (err) { console.error("Geocoding failed", err); }
      
      setResults(newResults);
      setLoading(false);
    }, 600);
  };

  const handleSelect = async (r: any) => {
    let newAddr = { street:'', number:'', complement:'', city:'', state:'', zip:'', country:'' };
    if (r.source === 'internal') {
       newAddr = { ...r.addressObj };
    } else if (r.source === 'google') {
       const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
       const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${r.place_id}&fields=address_components&key=${apiKey}`);
       const data = await res.json();
       const comps = data.result?.address_components || [];
       const getComp = (type: string) => comps.find((c:any) => c.types.includes(type))?.long_name || '';
       const getShort = (type: string) => comps.find((c:any) => c.types.includes(type))?.short_name || '';
       
       newAddr = {
         street: getComp('route'),
         number: getComp('street_number'),
         complement: '',
         city: getComp('locality') || getComp('administrative_area_level_2'),
         state: getShort('administrative_area_level_1'),
         zip: getComp('postal_code'),
         country: getComp('country')
       };
    } else if (r.source === 'photon') {
       const p = r.properties;
       newAddr = {
         street: p.street || p.name || '',
         number: p.housenumber || '',
         complement: '',
         city: p.city || p.town || p.county || '',
         state: p.state || '',
         zip: p.postcode || '',
         country: p.country || ''
       };
    }
    
    setAddr(newAddr);
    setQuery('');
    setResults([]);
  };

  const save = () => {
    setIsEditing(false);
    onSave(addr);
  };

  if (!canEdit) {
     return <span className="text-sm font-medium text-slate-700 truncate">{formatDisplay(value) || '—'}</span>;
  }

  if (!isEditing) {
     return (
       <div onClick={() => setIsEditing(true)} className="cursor-text hover:bg-slate-100 rounded px-2 py-1 -ml-2 transition-colors border border-transparent hover:border-slate-200 min-h-[30px] font-medium text-slate-700 w-full line-clamp-2">
          {formatDisplay(value) || <span className="text-slate-300 italic text-sm">Click to enter address...</span>}
       </div>
     );
  }

  return (
    <div className="bg-white border text-left border-indigo-300 rounded-xl shadow-xl p-4 z-50 absolute w-full max-w-[400px] min-w-[320px] -ml-2 -mt-2">
       <div className="text-xs font-bold text-indigo-500 mb-3 uppercase tracking-widest flex items-center gap-2"><MapPin size={12}/> Edit Address</div>
       <div className="relative mb-5">
         <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
         <input 
           autoFocus
           placeholder="Search CRM or Global Map..." 
           className="w-full pl-9 pr-3 py-2 text-sm font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 ring-indigo-500/30 outline-none"
           value={query}
           onChange={e => handleSearch(e.target.value)}
           onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
         />
         {loading && <div className="absolute right-3 top-2.5 text-indigo-400 text-xs font-bold animate-pulse uppercase tracking-wider">Searching...</div>}
         
         {results.length > 0 && (
           <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[300px] overflow-y-auto">
             {results.map((r, i) => (
               <div key={r.id || r.place_id || i} onClick={() => handleSelect(r)} className={`px-4 py-3 text-sm cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors flex items-start gap-3 ${r.source === 'internal' ? 'bg-indigo-50/30' : ''}`}>
                 <div className="mt-0.5 shrink-0">
                    {r.source === 'internal' ? (
                       r.internalType === 'org' ? <Building2 size={16} className="text-indigo-400"/> : <UserCircle2 size={16} className="text-indigo-400"/>
                    ) : (
                       <MapPin size={16} className="text-slate-400"/>
                    )}
                 </div>
                 <div className="flex-1 w-full overflow-hidden">
                    <div className="font-bold text-slate-800 flex items-center gap-2">
                        <span className="truncate">{r.name}</span>
                        {r.source === 'internal' && <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-black tracking-widest uppercase shrink-0">CRM</span>}
                    </div>
                    {r.display_name && r.display_name !== r.name && <div className="text-xs text-slate-500 truncate mt-0.5" title={r.display_name}>{r.display_name}</div>}
                 </div>
               </div>
             ))}
           </div>
         )}
       </div>

       <div className="grid grid-cols-2 gap-3 mb-4 animate-fade-in text-slate-700">
         <div className="col-span-2"><input placeholder="Street" className="input text-sm w-full py-2 bg-slate-50" value={addr.street} onChange={e=>setAddr({...addr, street: e.target.value})} /></div>
         <div><input placeholder="Number" className="input text-sm w-full py-2 bg-slate-50" value={addr.number} onChange={e=>setAddr({...addr, number: e.target.value})} /></div>
         <div><input placeholder="Complement" className="input text-sm w-full py-2 bg-slate-50" value={addr.complement} onChange={e=>setAddr({...addr, complement: e.target.value})} /></div>
         <div className="col-span-2"><input placeholder="City" className="input text-sm w-full py-2 bg-slate-50" value={addr.city} onChange={e=>setAddr({...addr, city: e.target.value})} /></div>
         <div><input placeholder="State" className="input text-sm w-full py-2 bg-slate-50" value={addr.state} onChange={e=>setAddr({...addr, state: e.target.value})} /></div>
         <div><input placeholder="Zip" className="input text-sm w-full py-2 bg-slate-50" value={addr.zip} onChange={e=>setAddr({...addr, zip: e.target.value})} /></div>
         <div className="col-span-2 border-t border-slate-100 pt-3 mt-1"><input placeholder="Country" className="input text-sm w-full py-2 bg-slate-50" value={addr.country} onChange={e=>setAddr({...addr, country: e.target.value})} /></div>
       </div>
       
       <div className="flex gap-3 border-t border-slate-100 pt-3 mt-1">
         <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 h-9 px-4 py-2 flex-1" onClick={(e) => { e.preventDefault(); setAddr(value || defaultAddr); setIsEditing(false); }}>Cancel</button>
         <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-9 px-4 py-2 flex-1" onClick={(e) => { e.preventDefault(); save(); }}>Confirm Output</button>
       </div>
    </div>
  );
}
