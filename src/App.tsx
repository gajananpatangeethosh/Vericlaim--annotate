import { useKeyboard } from './hooks/useKeyboard'
import Toolbar from './components/Toolbar/Toolbar'
import PDFViewer from './components/PDFViewer/PDFViewer'
import ReferenceViewer from './components/ReferenceViewer/ReferenceViewer'
import Sidebar from './components/Sidebar/Sidebar'
import AIDialog from './components/AIDialog/AIDialog'
import SelectionPopup from './components/ChatPanel/SelectionPopup'
import ChatPanel from './components/ChatPanel/ChatPanel'
import { useStore } from './store/useStore'

export default function App() {
  useKeyboard()
  const activeView = useStore((s) => s.activeView)

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        {activeView === 'reference' ? <ReferenceViewer /> : <PDFViewer />}
        <Sidebar />
      </div>
      <SelectionPopup />
      <ChatPanel />
      <AIDialog />
    </div>
  )
}
