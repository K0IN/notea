import NoteState from 'libs/web/state/note'
import { has } from 'lodash'
import router, { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import NoteTreeState from 'libs/web/state/tree'
import NoteNav from 'components/note-nav'
import UIState from 'libs/web/state/ui'
import noteCache from 'libs/web/cache/note'
import useSettingsAPI from 'libs/web/api/settings'
import dynamic from 'next/dynamic'
import { useToast } from 'libs/web/hooks/use-toast'
import DeleteAlert from 'components/editor/delete-alert'
import useRouterWarning from 'libs/web/state/ui/useRouterWarning'

const MainEditor = dynamic(() => import('components/editor/main-editor'))

export const EditContainer = () => {
  const {
    title: { updateTitle },
    settings: { settings },
  } = UIState.useContainer()
  const { genNewId } = NoteTreeState.useContainer()
  const {
    fetchNote,
    abortFindNote,
    findOrCreateNote,
    initNote,
    note,
  } = NoteState.useContainer()
  const { query } = useRouter()
  const [isSaved, setSaved] = useState(true)
  const pid = query.pid as string
  const id = query.id as string
  const isNew = has(query, 'new')
  const { mutate: mutateSettings } = useSettingsAPI()
  const toast = useToast()
  const saveRef = useRef<() => void>()

  const loadNoteById = useCallback(
    async (id: string) => {
      // daily notes
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(id)) {
        findOrCreateNote(id, {
          id,
          title: id,
          content: '\n',
          pid: settings.daily_root_id,
        })
      } else if (id === 'new') {
        const url = `/${genNewId()}?new` + (pid ? `&pid=${pid}` : '')

        router.replace(url, undefined, { shallow: true })
      } else if (id && !isNew) {
        try {
          const result = await fetchNote(id)
          if (!result) {
            router.replace({ query: { ...router.query, new: 1 } })
            return
          }
        } catch (msg) {
          if (msg.name !== 'AbortError') {
            toast(msg.message, 'error')
            router.push('/', undefined, { shallow: true })
          }
        }
      } else {
        if (await noteCache.getItem(id)) {
          router.push(`/${id}`, undefined, { shallow: true })
          return
        }

        initNote({
          id,
          content: '\n',
        })
      }

      if (!isNew && id !== 'new') {
        mutateSettings({
          last_visit: `/${id}`,
        })
      }
    },
    [
      isNew,
      findOrCreateNote,
      settings.daily_root_id,
      genNewId,
      pid,
      fetchNote,
      toast,
      initNote,
      mutateSettings,
    ]
  )

  useEffect(() => {
    abortFindNote()
    loadNoteById(id)
    setSaved(true)
  }, [loadNoteById, abortFindNote, id])

  useEffect(() => {
    updateTitle(`${!isSaved && settings.explicitSave ? '*' : ''}${note?.title}`)
  }, [isSaved, note?.title, settings.explicitSave, updateTitle])

  useRouterWarning(!isSaved && settings.explicitSave, () => {
    return confirm('Warning! You have unsaved changes.')
  })

  return (
    <>
      <NoteNav
        explicitSave={settings.explicitSave}
        isSaved={isSaved}
        saveRef={saveRef}
      />
      <DeleteAlert />
      <section className="h-full">
        <MainEditor
          note={note}
          explicitSave={settings.explicitSave}
          saveState={setSaved}
          saveRef={saveRef}
        />
      </section>
    </>
  )
}
