import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Building2, User, BriefcaseBusiness } from 'lucide-react'
import { CrmMentionResult } from '@/lib/crmService'

export interface MentionListProps {
  items: CrmMentionResult[]
  command: (item: { id: string, label: string, type: string }) => void
}

export const MentionList = forwardRef((props: MentionListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    setSelectedIndex(0)
  }, [props.items])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % props.items.length)
        return true
      }
      if (event.key === 'Enter') {
        enterHandler()
        return true
      }
      return false
    },
  }))

  const enterHandler = () => {
    selectItem(selectedIndex)
  }

  const selectItem = (index: number) => {
    const item = props.items[index]

    if (item) {
      props.command({ id: item.id, label: item.label, type: item.type })
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden min-w-[280px] p-1 flex flex-col gap-1 max-h-[300px] overflow-y-auto z-50">
      {props.items.length ? props.items.map((item, index) => {
        const Icon = item.icon === 'Building2' ? Building2 : (item.icon === 'User' ? User : BriefcaseBusiness)
        return (
          <button
            key={index}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors text-sm w-full outline-none
              ${index === selectedIndex ? 'bg-indigo-50 text-indigo-900 border border-indigo-100' : 'text-slate-700 hover:bg-slate-50 border border-transparent'}`}
            onClick={() => selectItem(index)}
          >
            <div className={`p-1.5 rounded-md ${index === selectedIndex ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
               <Icon size={16} />
            </div>
            <div className="flex flex-col flex-1 truncate">
              <span className="font-medium truncate leading-tight">{item.label}</span>
              {item.subtitle && <span className={`text-[0.7rem] leading-tight mt-0.5 ${index === selectedIndex ? 'text-indigo-500' : 'text-slate-400'}`}>{item.subtitle}</span>}
            </div>
          </button>
        )
      }) : (
        <div className="p-3 text-sm text-slate-500 text-center">No results found</div>
      )}
    </div>
  )
})
MentionList.displayName = 'MentionList'
