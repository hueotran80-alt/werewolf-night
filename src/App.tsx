import React, { useEffect, useState } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { HomeScreen } from './components/HomeScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { RoleRevealScreen } from './components/RoleRevealScreen';
import { GameStartDealScreen } from './components/GameStartDealScreen';
import { NightPhaseView } from './components/NightPhaseView';
import { DayPhaseView } from './components/DayPhaseView';
import { VotingPhaseView } from './components/VotingPhaseView';
import { VictoryScreen } from './components/VictoryScreen';
import { VoiceCallBar } from './components/VoiceCallBar';
import { MyCardModal } from './components/MyCardModal';
import { CardLibraryModal } from './components/CardLibraryModal';
import { GuideModal } from './components/GuideModal';
import { SettingsModal } from './components/SettingsModal';
import { HostTransferModal } from './components/HostTransferModal';
import { AlertCircle, Eye, Check, X, Sparkles, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('Caught in ErrorBoundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#05070E] text-zinc-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full p-8 rounded-3xl bg-zinc-900/90 border border-zinc-800 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold font-serif text-white">Đã xảy ra sự cố giao diện</h2>
              <p className="text-xs text-zinc-400">
                Ứng dụng vừa gặp một lỗi nhỏ. Nhấn nút bên dưới để tải lại trạng thái.
              </p>
            </div>
            <button
              onClick={this.handleReset}
              className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 mx-auto transition shadow-lg"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Tải lại trò chơi</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function GameRoot() {
  const {
    nickname,
    setNickname,
    currentRoom,
    gameState,
    myPlayer,
    myRole,
    isHost,
    chatMessages,
    sendChat,
    createRoom,
    joinRoom,
    leaveRoom,
    updateDeck,
    updateSettings,
    startGame,
    submitAction,
    submitVote,
    transferHost,
    respondHostTransfer,
    addBotPlayer,
    kickPlayer,
    returnToLobby,
    restartWithSamePlayers,
    error,
    clearError,
    activeTransferRequest,
    seerResultPopup,
    clearSeerPopup,
  } = useGame();

  // Modal Visibility States
  const [showMyCard, setShowMyCard] = useState(false);
  const [showDeckLibrary, setShowDeckLibrary] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStartDeal, setShowStartDeal] = useState(false);
  useEffect(() => {
  if (currentRoom && gameState?.currentPhase === 'ROLE_REVEAL') {
    setShowStartDeal(true);
  } else {
    setShowStartDeal(false);
  }
}, [currentRoom?.id, gameState?.currentPhase]);

  // If not currently in a room, render Home Screen
  if (!currentRoom) {
    return (
      <>
        <HomeScreen
          nickname={nickname}
          onSetNickname={setNickname}
          onCreateRoom={(pName) => createRoom(pName)}
          onJoinRoom={(code, pName) => joinRoom(code, pName)}
          onOpenDeckLibrary={() => setShowDeckLibrary(true)}
          onOpenGuide={() => setShowGuide(true)}
          onOpenSettings={() => setShowSettings(true)}
        />

        <CardLibraryModal
          isOpen={showDeckLibrary}
          onClose={() => setShowDeckLibrary(false)}
        />

        <GuideModal
          isOpen={showGuide}
          onClose={() => setShowGuide(false)}
        />


        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />

        {error && (
          <div className="fixed bottom-5 right-5 z-50 p-4 rounded-2xl bg-rose-950/90 border border-rose-700 text-white shadow-2xl flex items-center gap-3 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-rose-400" />
            <span className="text-xs font-semibold">{error}</span>
            <button onClick={clearError} className="p-1 hover:bg-rose-900 rounded-lg text-rose-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </>
    );
  }

  // Active in a Room -> Render respective phase
  const currentPhase = gameState?.currentPhase || 'LOBBY';

  return (
    <div className="min-h-screen werewolf-fantasy-bg text-zinc-100 flex flex-col justify-between relative overflow-x-hidden">
      {/* Gothic Ambient Gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-indigo-950/20 via-rose-950/10 to-transparent blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 border-b border-zinc-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-serif font-black tracking-wider text-white uppercase">
            WEREWOLF: NIGHT OF DECEPTION
          </span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
            Phòng: {currentRoom.code}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGuide(true)}
            className="px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-medium transition"
          >
            📖 Luật chơi
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-medium transition"
          >
            ⚙️ Cài đặt
          </button>
        </div>
      </header>

      {/* Dynamic Game Phase Screen */}
      <main className="relative z-10 w-full max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex-1 flex flex-col">
        <VoiceCallBar />

        {currentPhase === 'LOBBY' && myPlayer && (
          <LobbyScreen
            room={currentRoom}
            myPlayer={myPlayer}
            isHost={isHost}
            chatMessages={chatMessages}
            onStartGame={startGame}
            onUpdateDeck={updateDeck}
            onUpdateSettings={updateSettings}
            onAddBot={addBotPlayer}
            onKickPlayer={kickPlayer}
            onTransferHost={transferHost}
            onLeaveRoom={leaveRoom}
            onSendChat={(text) => sendChat(text, 'LOBBY')}
          />
        )}

        {currentPhase === 'ROLE_REVEAL' && myRole && (
  <>
    {showStartDeal ? (
      <GameStartDealScreen
        room={currentRoom}
        onFinished={() => {
          setShowStartDeal(false);
        }}
      />
    ) : (
      <RoleRevealScreen
        room={currentRoom}
        roleId={myRole}
        onUnderstood={() => {}}
      />
    )}
  </>
)}

        {(currentPhase === 'NIGHT' || currentPhase === 'HUNTER_REVENGE') && myPlayer && (
          <NightPhaseView
            room={currentRoom}
            myPlayer={myPlayer}
            myRole={myRole}
            onSubmitAction={submitAction}
            onOpenMyCard={() => setShowMyCard(true)}
          />
        )}

        {(currentPhase === 'DAY_ANNOUNCEMENT' || currentPhase === 'DAY_DISCUSSION' || currentPhase === 'DEATH_REBUTTAL') && myPlayer && (
          <DayPhaseView
            room={currentRoom}
            myPlayer={myPlayer}
            myRole={myRole}
            chatMessages={chatMessages}
            onSendChat={(text, channel) => sendChat(text, channel)}
            onOpenMyCard={() => setShowMyCard(true)}
          />
        )}

        {(currentPhase === 'VOTING' || currentPhase === 'VOTE_RESOLUTION') && myPlayer && (
          <VotingPhaseView
            room={currentRoom}
            myPlayer={myPlayer}
            myRole={myRole}
            onSubmitVote={submitVote}
            onOpenMyCard={() => setShowMyCard(true)}
          />
        )}

        {currentPhase === 'GAME_OVER' && myPlayer && (
          <VictoryScreen
            room={currentRoom}
            myPlayer={myPlayer}
            isHost={isHost}
            onRestart={restartWithSamePlayers}
            onReturnToLobby={returnToLobby}
            onGoHome={leaveRoom}
          />
        )}
      </main>

      {/* Floating Modals */}
      <MyCardModal
        isOpen={showMyCard}
        onClose={() => setShowMyCard(false)}
        roleId={myRole}
        isAlive={myPlayer?.isAlive ?? true}
        deathReason={myPlayer?.deathReason}
      />

      <CardLibraryModal
        isOpen={showDeckLibrary}
        onClose={() => setShowDeckLibrary(false)}
      />

      <GuideModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
      />


      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <HostTransferModal
        request={activeTransferRequest}
        onRespond={respondHostTransfer}
      />

      {/* Seer Private Result Popup */}
      {seerResultPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-[#0C101C] border border-cyan-500/50 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto">
              <Eye className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-bold text-white font-serif tracking-wide">
                KẾT QUẢ SOI DANH TÍNH
              </h4>
              <p className="text-xs text-zinc-300">
                Bạn đã dùng nhãn thuật soi vào tâm trí của <strong>{seerResultPopup.targetName}</strong>:
              </p>
            </div>

            <div
              className={`p-3.5 rounded-2xl font-bold text-sm ${
                seerResultPopup.isWerewolf
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-700/60'
                  : 'bg-blue-950/80 text-blue-300 border border-blue-700/60'
              }`}
            >
              {seerResultPopup.isWerewolf ? '🐺 ĐÂY LÀ MA SÓI!' : '👨 ĐÂY KHÔNG PHẢI MA SÓI'}
            </div>

            <button
              onClick={clearSeerPopup}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition"
            >
              Đã Rõ
            </button>
          </div>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="fixed bottom-5 right-5 z-50 p-4 rounded-2xl bg-rose-950/90 border border-rose-700 text-white shadow-2xl flex items-center gap-3 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-rose-400" />
          <span className="text-xs font-semibold">{error}</span>
          <button onClick={clearError} className="p-1 hover:bg-rose-900 rounded-lg text-rose-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <GameProvider>
        <GameRoot />
      </GameProvider>
    </ErrorBoundary>
  );
}

export default App;
