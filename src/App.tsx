import { RecordingControls } from '@/components/RecordingControls'
import { ActionsList } from '@/components/ActionsList'
import { SettingsPanel } from '@/components/SettingsPanel'
import { StatusBar } from '@/components/StatusBar'
import { TitleBar } from '@/components/TitleBar'
import { TranscriptView } from '@/components/TranscriptView'
import { useRecordingStore } from '@/stores/recordingStore'
import saurusIcon from '@/assets/saurus.png'
import { FileText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useShallow } from 'zustand/react/shallow'

export default function App() {
  const { status, actions, transcriptText, isTranscriptViewOpen, setTranscriptViewOpen } = useRecordingStore(
    useShallow((state) => ({
      status: state.status,
      actions: state.actions,
      transcriptText: state.transcriptText,
      isTranscriptViewOpen: state.isTranscriptViewOpen,
      setTranscriptViewOpen: state.setTranscriptViewOpen,
    }))
  )
  
  const canViewTranscript = status === 'idle' && actions.length > 0 && transcriptText
  
  return (
    <div className="h-screen flex flex-col overflow-hidden select-none">
      <TitleBar />
      
      <header className="flex-shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={saurusIcon} alt="Dodo Recorder" className="w-8 h-8 rounded-lg" />
            <h1 className="text-sm font-semibold text-foreground">Dodo Recorder</h1>
          </div>
          <StatusBar />
        </div>
      </header>
      
      <main className="flex-1 flex overflow-hidden">
        <aside className="w-80 border-r border-border bg-card flex flex-col flex-shrink-0">
          <SettingsPanel />
          <RecordingControls />
        </aside>
        
        {isTranscriptViewOpen ? (
          <section className="flex-1 flex overflow-hidden bg-background">
            <div className="flex-1 min-w-0 border-r border-border bg-background flex flex-col">
              <div className="flex-shrink-0 px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-medium text-foreground">Recorded Actions</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Click on transcript to highlight actions
                  </p>
                </div>
              </div>
              <ActionsList />
            </div>
            <TranscriptView />
          </section>
        ) : (
          <section className="flex-1 flex flex-col overflow-hidden bg-background">
            <div className="flex-shrink-0 px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium text-foreground">Recorded Actions</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {status === 'recording' ? 'Recording in progress...' : 'Actions will appear here during recording'}
                </p>
              </div>
              {canViewTranscript && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setTranscriptViewOpen(true)}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <FileText className="h-4 w-4" />
                  View transcript
                </Button>
              )}
            </div>
            <ActionsList />
          </section>
        )}
      </main>
    </div>
  )
}
