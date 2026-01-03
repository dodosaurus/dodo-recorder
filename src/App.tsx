import { RecordingControls } from '@/components/RecordingControls'
import { ActionsList } from '@/components/ActionsList'
import { SettingsPanel } from '@/components/SettingsPanel'
import { StatusBar } from '@/components/StatusBar'
import { TitleBar } from '@/components/TitleBar'
import { useRecordingStore } from '@/stores/recordingStore'

export default function App() {
  const status = useRecordingStore((state) => state.status)
  
  return (
    <div className="h-screen flex flex-col overflow-hidden select-none">
      <TitleBar />
      
      <header className="flex-shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">Dodo Recorder</h1>
              <p className="text-xs text-muted-foreground">Browser action recorder</p>
            </div>
          </div>
          <StatusBar />
        </div>
      </header>
      
      <main className="flex-1 flex overflow-hidden">
        <aside className="w-80 border-r border-border bg-card flex flex-col">
          <SettingsPanel />
          <RecordingControls />
        </aside>
        
        <section className="flex-1 flex flex-col overflow-hidden bg-background">
          <div className="flex-shrink-0 px-4 py-3 border-b border-border">
            <h2 className="text-sm font-medium text-foreground">Recorded Actions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {status === 'recording' ? 'Recording in progress...' : 'Actions will appear here during recording'}
            </p>
          </div>
          <ActionsList />
        </section>
      </main>
    </div>
  )
}
