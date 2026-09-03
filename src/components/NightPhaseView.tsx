import React, { useMemo, useState } from 'react';
import { Player, RoomData, RoleId, GameAction, NightStep } from '../types';
import { ROLES_DATABASE } from '../data/rolesData';
import {
  Moon,
  Shield,
  Eye,
  Skull,
  Crosshair,
  Check,
  Sparkles,
  Mic,
  Heart,
  Volume2,
  HeartHandshake,
} from 'lucide-react';

interface Props {
  room: RoomData;
  myPlayer: Player;
  myRole: RoleId | null;
  onSubmitAction: (action: GameAction) => void;
  onOpenMyCard: () => void;
}

const STEP_LABELS: Record<NightStep, string> = {
  CUPID_PAIR: '💘 Thần Tình Yêu',
  WEREWOLF_HUNT: '🐺 Ma Sói',
  SERIAL_KILLER_HUNT: '🔪 Kẻ Sát Nhân',
  WITCH_HEAL: '🧙‍♀️ Phù Thủy — Bình Cứu',
  WITCH_POISON: '🧙‍♀️ Phù Thủy — Bình Độc',
  OTHER_ROLES: '✨ Năng lực đồng loạt',
  SEER_INVESTIGATE: '🔮 Tiên Tri',
  BODYGUARD_PROTECT: '🛡️ Bảo Vệ',
  LIEU_SILENCE: '🍃 Liễu',
  HUNTER_SHOT: '💥 Thợ Săn',
  NONE: '🌙 Đang chuyển lượt',
};

export const NightPhaseView: React.FC<Props> = ({
  room,
  myPlayer,
  myRole,
  onSubmitAction,
  onOpenMyCard,
}) => {
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [secondCupidTargetId, setSecondCupidTargetId] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [wolfConfirmChoice, setWolfConfirmChoice] = useState<boolean | null>(null);
  const [now, setNow] = useState(Date.now());

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const gameState = room.gameState;
  const nightState = gameState?.nightState;
  const step = nightState?.currentStep || 'NONE';
  const isHunterRevenge = gameState?.currentPhase === 'HUNTER_REVENGE';
  const roleDef = myRole ? ROLES_DATABASE[myRole] : null;
  const isWerewolf = roleDef?.team === 'WEREWOLF';
  const isAlphaWolf = myRole === 'ALPHA_WOLF';

  const remainingSeconds = gameState?.phaseEndsAt
    ? Math.max(0, Math.ceil((gameState.phaseEndsAt - now) / 1000))
    : 0;

  // Re-arm the local buttons whenever the server moves to another night step.
  React.useEffect(() => {
    setHasSubmitted(false);
    setSelectedTargetId(null);
    setSecondCupidTargetId(null);
    setWolfConfirmChoice(null);
  }, [step, gameState?.roundNumber]);

  React.useEffect(() => {
    if (step === 'WEREWOLF_HUNT' && !nightState?.werewolfProposalTarget) {
      setHasSubmitted(false);
      setWolfConfirmChoice(null);
      setSelectedTargetId(null);
    }
  }, [step, nightState?.werewolfProposalTarget]);

  const livingPlayers = room.players.filter((p) => p.isAlive);

  const selectablePlayers = useMemo(() => {
    return livingPlayers.filter((p) => {
      if (p.id === myPlayer.id && myRole !== 'BODYGUARD') return false;

      if (isWerewolf) {
        if (p.role && ROLES_DATABASE[p.role]?.team === 'WEREWOLF') return false;
        if (nightState?.werewolfKillTargets?.includes(p.id)) return false;
      }

      return true;
    });
  }, [livingPlayers, myPlayer.id, isWerewolf, nightState?.werewolfKillTargets]);

  const isMyActiveStep =
    !isHunterRevenge &&
    (
      (step === 'CUPID_PAIR' && myRole === 'CUPID') ||
      (step === 'WEREWOLF_HUNT' && isWerewolf) ||
      (step === 'SERIAL_KILLER_HUNT' && myRole === 'SERIAL_KILLER') ||
      (step === 'WITCH_HEAL' && myRole === 'WITCH') ||
      (step === 'WITCH_POISON' && myRole === 'WITCH') ||
      (step === 'OTHER_ROLES' && ['SEER', 'BODYGUARD', 'LIEU'].includes(myRole || ''))
    );

  const submit = (action: GameAction) => {
    onSubmitAction(action);
    setHasSubmitted(true);
  };

  const handleTargetClick = (p: Player) => {
    if (!myPlayer.isAlive && !isHunterRevenge) return;
    if (hasSubmitted) return;
    setSelectedTargetId(p.id);
  };

  const handleCupidPair = () => {
    if (!selectedTargetId || !secondCupidTargetId || selectedTargetId === secondCupidTargetId) return;

    submit({
      actionType: 'CUPID_PAIR',
      actorPlayerId: myPlayer.id,
      targetPlayerId: selectedTargetId,
      extraData: { secondTargetPlayerId: secondCupidTargetId },
    });
  };

  const handleWolfProposal = () => {
    if (!selectedTargetId) return;
    submit({
      actionType: 'WOLF_KILL',
      actorPlayerId: myPlayer.id,
      targetPlayerId: selectedTargetId,
    });
  };

  const handleWolfConfirm = (confirmed: boolean) => {
    const target = nightState?.werewolfProposalTarget;
    if (!target || hasSubmitted) return;

    setWolfConfirmChoice(confirmed);
    submit({
      actionType: 'WOLF_CONFIRM',
      actorPlayerId: myPlayer.id,
      targetPlayerId: target,
      extraData: { confirmed },
    });
  };

  const handleSerialKiller = () => {
    if (!selectedTargetId) return;
    submit({
      actionType: 'SERIAL_KILL',
      actorPlayerId: myPlayer.id,
      targetPlayerId: selectedTargetId,
    });
  };

  const handleWitchHeal = (use: boolean) => {
    submit({
      actionType: use ? 'WITCH_HEAL' : 'WITCH_DECLINE_HEAL',
      actorPlayerId: myPlayer.id,
    });
  };

  const handleWitchPoison = (use: boolean) => {
    if (use && !selectedTargetId) return;
    submit({
      actionType: use ? 'WITCH_POISON' : 'WITCH_DECLINE_POISON',
      actorPlayerId: myPlayer.id,
      ...(use ? { targetPlayerId: selectedTargetId! } : {}),
    });
  };

  const handleRoleAction = () => {
    if (!selectedTargetId) return;

    if (myRole === 'SEER') {
      submit({
        actionType: 'SEER_CHECK',
        actorPlayerId: myPlayer.id,
        targetPlayerId: selectedTargetId,
      });
    } else if (myRole === 'BODYGUARD') {
      if (nightState?.lastGuardedPlayerId === selectedTargetId) return;
      submit({
        actionType: 'BODYGUARD_GUARD',
        actorPlayerId: myPlayer.id,
        targetPlayerId: selectedTargetId,
      });
    } else if (myRole === 'LIEU') {
      submit({
        actionType: 'LIEU_SILENCE',
        actorPlayerId: myPlayer.id,
        targetPlayerId: selectedTargetId,
      });
    }
  };

  const renderTargets = (mode: 'normal' | 'cupid' = 'normal') => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {room.players.map((p) => {
        const isDead = !p.isAlive;
        const isMe = p.id === myPlayer.id;
        const isWolfTeammate =
          isWerewolf &&
          p.role &&
          ROLES_DATABASE[p.role]?.team === 'WEREWOLF';
        const isSelected = selectedTargetId === p.id;
        const isSecondSelected = secondCupidTargetId === p.id;
        const isPreviousWolfTarget = nightState?.werewolfKillTargets?.includes(p.id);

        const disabled =
          isDead ||
          (isMe && myRole !== 'BODYGUARD') ||
          hasSubmitted ||
          (isWolfTeammate && step === 'WEREWOLF_HUNT') ||
          (isPreviousWolfTarget && step === 'WEREWOLF_HUNT') ||
          (myRole === 'BODYGUARD' && nightState?.lastGuardedPlayerId === p.id);

        return (
          <button
            key={p.id}
            disabled={disabled}
            onClick={() => {
              if (mode === 'cupid') {
                if (selectedTargetId === p.id) {
                  setSelectedTargetId(null);
                } else if (secondCupidTargetId === p.id) {
                  setSecondCupidTargetId(null);
                } else if (!selectedTargetId) {
                  setSelectedTargetId(p.id);
                } else if (!secondCupidTargetId) {
                  setSecondCupidTargetId(p.id);
                }
              } else {
                handleTargetClick(p);
              }
            }}
            className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between h-28 ${
              isDead
                ? 'bg-zinc-950/40 border-zinc-900 opacity-40'
                : disabled
                ? 'bg-zinc-900/40 border-zinc-800/70 opacity-60'
                : isSelected || isSecondSelected
                ? 'bg-zinc-800/90 border-cyan-400 ring-2 ring-cyan-500/40 shadow-xl'
                : 'bg-zinc-900/40 border-zinc-800/80 hover:bg-zinc-850 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-zinc-800 to-zinc-700 flex items-center justify-center font-bold text-xs text-white border border-zinc-600">
                {p.nickname.charAt(0).toUpperCase()}
              </div>

              {isWolfTeammate && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-bold">
                  🐺 Sói
                </span>
              )}

              {isMe && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800 font-bold">
                  Bạn
                </span>
              )}
            </div>

            <div>
              <div className="font-bold text-xs text-white truncate">{p.nickname}</div>
              <div className="text-[10px] text-zinc-400 mt-0.5">
                {isDead ? '💀 Đã chết' : '✨ Còn sống'}
              </div>
            </div>

            {(isSelected || isSecondSelected) && (
              <div className="absolute top-2 right-2 p-1 rounded-full bg-cyan-500 text-black">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  const rolePanel = () => {
    if (isHunterRevenge) {
      return (
        <>
          {renderTargets()}
          <ActionBar
            text="💥 Thợ Săn: chọn người để bắn hạ."
            button="BẮN HẠ MỤC TIÊU"
            disabled={!selectedTargetId || hasSubmitted}
            onClick={() => {
              if (!selectedTargetId) return;
              submit({
                actionType: 'HUNTER_KILL',
                actorPlayerId: myPlayer.id,
                targetPlayerId: selectedTargetId,
              });
            }}
            icon={<Crosshair className="w-3.5 h-3.5" />}
          />
        </>
      );
    }

    if (step === 'CUPID_PAIR' && myRole === 'CUPID') {
      return (
        <>
          {renderTargets('cupid')}
          <ActionBar
            text="💘 Đêm đầu: chọn đúng 2 người để ghép cặp. Bạn + 2 người được ghép là 3 người duy nhất biết."
            button="GHÉP CẶP"
            disabled={!selectedTargetId || !secondCupidTargetId || hasSubmitted}
            onClick={handleCupidPair}
            icon={<HeartHandshake className="w-3.5 h-3.5" />}
          />
        </>
      );
    }

    if (step === 'WEREWOLF_HUNT' && isWerewolf) {
      const proposalId = nightState?.werewolfProposalTarget;
      const proposalPlayer = room.players.find((p) => p.id === proposalId);
      const hasMyConfirmation = nightState?.werewolfConfirmations?.[myPlayer.id] !== undefined;
      const canPropose = !proposalId;
      const isProposer = Object.keys(nightState?.werewolfVotes || {}).includes(myPlayer.id);

      return (
        <>
          {canPropose && renderTargets()}
          {!canPropose && (
            <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-800/50 space-y-3">
              <div className="flex items-center gap-2 text-rose-200 text-sm font-bold">
                <Volume2 className="w-4 h-4" />
                Đề xuất cắn: <span className="text-white">{proposalPlayer?.nickname || 'Mục tiêu'}</span>
              </div>

              {isProposer ? (
                <div className="text-xs text-rose-300">
                  Bạn đã đề xuất mục tiêu. Hãy chờ các Sói còn sống biểu quyết.
                </div>
              ) : hasMyConfirmation ? (
                <div className="text-xs text-zinc-300">
                  Bạn đã chọn <strong>{nightState?.werewolfConfirmations?.[myPlayer.id] ? 'CÓ' : 'KHÔNG'}</strong>. Chờ bầy Sói quyết định.
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleWolfConfirm(true)}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                  >
                    CÓ, CHẮC CHẮN CẮN NGƯỜI NÀY
                  </button>
                  <button
                    onClick={() => handleWolfConfirm(false)}
                    className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold"
                  >
                    KHÔNG
                  </button>
                </div>
              )}
            </div>
          )}

          {canPropose && (
            <ActionBar
              text={
                isAlphaWolf
                  ? '🐺 Sói Trưởng là người duy nhất có quyền quyết định cuối cùng.'
                  : nightState?.werewolfKillTargets?.length
                  ? '🐺 Sói Con đã kích hoạt cuồng nộ: hãy chọn người thứ hai, không được chọn lại người thứ nhất.'
                  : '🐺 Sói đang thảo luận bằng mic. Một Sói đề xuất mục tiêu, các Sói còn lại xác nhận.'
              }
              button={isAlphaWolf ? 'XÁC NHẬN CẮN' : 'ĐỀ XUẤT MỤC TIÊU'}
              disabled={!selectedTargetId || hasSubmitted}
              onClick={handleWolfProposal}
              icon={<Skull className="w-3.5 h-3.5" />}
            />
          )}
        </>
      );
    }

    if (step === 'SERIAL_KILLER_HUNT' && myRole === 'SERIAL_KILLER') {
      return (
        <>
          {renderTargets()}
          <ActionBar
            text="🔪 Kẻ Sát Nhân: trong 60 giây chọn người và xác nhận. Không muốn giết ai thì bấm BỎ QUA."
            button="XÁC NHẬN GIẾT"
            disabled={!selectedTargetId || hasSubmitted}
            onClick={handleSerialKiller}
            icon={<Skull className="w-3.5 h-3.5" />}
          />
          <button
            disabled={hasSubmitted}
            onClick={() => submit({
              actionType: 'SERIAL_KILL_SKIP',
              actorPlayerId: myPlayer.id,
            })}
            className="w-full px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold"
          >
            BỎ QUA — KHÔNG GIẾT AI
          </button>
        </>
      );
    }

    if (step === 'WITCH_HEAL' && myRole === 'WITCH') {
      const victims = nightState?.witchVictimNames || [];
      return (
        <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-800/50 space-y-3">
          <div className="text-sm text-purple-200 font-bold">
            🧙‍♀️ Phù Thủy được biết nạn nhân Sói cắn:
          </div>
          <div className="text-lg font-bold text-white">
            {victims.length ? victims.join(' và ') : 'Đêm nay không có ai bị Sói cắn.'}
          </div>
          <div className="text-xs text-zinc-400">
            Vai trò của nạn nhân <strong>không được tiết lộ</strong>.
          </div>
          <div className="flex gap-2">
            <button
              disabled={hasSubmitted || !nightState?.witchHasHeal || !victims.length}
              onClick={() => handleWitchHeal(true)}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold"
            >
              <Heart className="inline w-3.5 h-3.5 mr-1" /> DÙNG BÌNH CỨU
            </button>
            <button
              disabled={hasSubmitted}
              onClick={() => handleWitchHeal(false)}
              className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold"
            >
              KHÔNG CỨU
            </button>
          </div>
        </div>
      );
    }

    if (step === 'WITCH_POISON' && myRole === 'WITCH') {
      return (
        <>
          {renderTargets()}
          <ActionBar
            text="🧙‍♀️ Bạn có 30 giây để dùng Bình Độc. Không dùng thì bấm BỎ QUA."
            button="DÙNG BÌNH ĐỘC"
            disabled={!selectedTargetId || hasSubmitted || !nightState?.witchHasPoison}
            onClick={() => handleWitchPoison(true)}
            icon={<Skull className="w-3.5 h-3.5" />}
          />
          <button
            disabled={hasSubmitted}
            onClick={() => handleWitchPoison(false)}
            className="w-full px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold"
          >
            BỎ QUA — KHÔNG DÙNG BÌNH ĐỘC
          </button>
        </>
      );
    }

    if (step === 'OTHER_ROLES' && ['SEER', 'BODYGUARD', 'LIEU'].includes(myRole || '')) {
      if (myRole === 'SEER') {
        return (
          <>
            {renderTargets()}
            <ActionBar
              text="🔮 Tiên Tri: soi 1 người. Kết quả chỉ mình bạn biết."
              button="SOI DANH TÍNH"
              disabled={!selectedTargetId || hasSubmitted}
              onClick={handleRoleAction}
              icon={<Eye className="w-3.5 h-3.5" />}
            />
          </>
        );
      }

      if (myRole === 'BODYGUARD') {
        return (
          <>
            {renderTargets()}
            <ActionBar
              text="🛡️ Bảo Vệ: chọn 1 người để bảo vệ khỏi các đòn giết ban đêm."
              button="BẢO VỆ MỤC TIÊU"
              disabled={!selectedTargetId || hasSubmitted}
              onClick={handleRoleAction}
              icon={<Shield className="w-3.5 h-3.5" />}
            />
          </>
        );
      }

      return (
        <>
          {renderTargets()}
          <ActionBar
            text="🍃 Liễu: chọn 1 người để phong ấn, khóa mic và chat vào ban ngày."
            button="KHÓA MIC & CHAT"
            disabled={!selectedTargetId || hasSubmitted}
            onClick={handleRoleAction}
            icon={<Mic className="w-3.5 h-3.5" />}
          />
        </>
      );
    }

    return (
      <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-center text-sm text-zinc-400">
        😴 Bạn đang ngủ. Hiện tại là lượt <strong className="text-zinc-200">{STEP_LABELS[step]}</strong>.
      </div>
    );
  };

  return (
    <div className="w-full flex-1 flex flex-col max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between p-4 rounded-3xl bg-zinc-950/70 border border-zinc-800/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 animate-pulse">
            <Moon className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-white font-serif tracking-wide">
              {isHunterRevenge ? '💥 THỢ SĂN TRẢ THÙ' : `🌙 BAN ĐÊM — VÒNG ${gameState?.roundNumber || 1}`}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {isHunterRevenge
                ? 'Thợ Săn chọn 1 người để kéo theo.'
                : STEP_LABELS[step]}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {step === 'WEREWOLF_HUNT' && isWerewolf && (
            <span className="px-3 py-1.5 rounded-2xl bg-rose-950/60 border border-rose-700/50 text-[11px] font-bold text-rose-300 flex items-center gap-1">
              <Mic className="w-3.5 h-3.5" /> MIC SÓI MỞ
            </span>
          )}
          <div className="px-3.5 py-1.5 rounded-2xl bg-zinc-900 border border-zinc-800 font-mono text-xs font-bold text-cyan-400">
            ⏳ {remainingSeconds}s
          </div>
          <button
            onClick={onOpenMyCard}
            className="px-3.5 py-1.5 rounded-2xl bg-purple-950/60 hover:bg-purple-900 border border-purple-700/50 text-xs font-bold text-purple-300 transition"
          >
            🃏 Lá Bài
          </button>
        </div>
      </div>

      {step === 'WEREWOLF_HUNT' && isWerewolf && (
        <div className="p-3 rounded-2xl bg-rose-950/20 border border-rose-900/40 text-xs text-rose-200 flex items-center gap-2">
          <Volume2 className="w-4 h-4" />
          Chỉ Ma Sói còn sống được mở mic và nghe nhau. Hết 45 giây hoặc đạt quyết định chung thì lượt Sói kết thúc.
        </div>
      )}

      {step === 'CUPID_PAIR' && myRole === 'CUPID' && (
        <div className="p-3 rounded-2xl bg-pink-950/20 border border-pink-900/40 text-xs text-pink-200">
          💘 Chọn 2 người khác nhau. Sau khi xác nhận, Thần Tình Yêu và đúng 2 người được ghép sẽ nhận thông báo riêng.
        </div>
      )}

      <div className="p-4 sm:p-5 rounded-3xl bg-zinc-950/80 border border-zinc-800 shadow-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-zinc-350 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>{roleDef?.vietnameseName || 'Dân Thường'}</span>
          </div>
          {hasSubmitted && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/50 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Đã gửi
            </span>
          )}
        </div>

        {rolePanel()}
      </div>
    </div>
  );
};

const ActionBar: React.FC<{
  text: string;
  button: string;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}> = ({ text, button, disabled, onClick, icon }) => (
  <div className="p-3.5 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
    <div className="text-xs text-zinc-200">{text}</div>
    <button
      disabled={disabled}
      onClick={onClick}
      className="w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white shadow-lg transition flex items-center justify-center gap-1.5"
    >
      {icon}
      <span>{button}</span>
    </button>
  </div>
);
