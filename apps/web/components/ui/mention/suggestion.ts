import { ReactRenderer } from '@tiptap/react'
import tippy, { Instance as TippyInstance } from 'tippy.js'
import { MentionList, MentionListProps } from './MentionList'
import { searchCrmRecords, CrmMentionResult } from '@/lib/crmService'

export default {
  items: async ({ query }: { query: string }): Promise<CrmMentionResult[]> => {
    return await searchCrmRecords(query);
  },

  render: () => {
    let component: ReactRenderer<any, MentionListProps>
    let popup: TippyInstance[]

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        })

        if (!props.clientRect) {
          return
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        })
      },

      onUpdate(props: any) {
        component.updateProps(props)

        if (!props.clientRect) {
          return
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        })
      },

      onKeyDown(props: any) {
        if (props.event.key === 'Escape') {
          popup[0].hide()
          return true
        }

        return component.ref?.onKeyDown(props) || false
      },

      onExit() {
        popup[0].destroy()
        component.destroy()
      },
    }
  },
}
