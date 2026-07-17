"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type XORoom = {
  id: string;
  created_at: string;
  player1_id: string | null;
  player2_id: string | null;
  player1_name: string | null;
  player2_name: string | null;
  status: string;
  target_time: number | null;
  p1_start: number | null;
  p1_stop: number | null;
  p2_start: number | null;
  p2_stop: number | null;
  xo_board: string[] | null;
  game_winner: string | null;
};

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

export default function XORoomClient({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [room, setRoom] = useState<XORoom | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [needsName, setNeedsName] = useState(false);
  const [copied, setCopied] = useState(false);

  // Challenge State
  const [localStart, setLocalStart] = useState<number | null>(null);
  const [isCounting, setIsCounting] = useState(false);

  useEffect(() => {
    let storedId = localStorage.getItem("bingo_player_id");
    if (!storedId) {
      storedId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
      localStorage.setItem("bingo_player_id", storedId);
    }
    setPlayerId(storedId);

    const storedName = localStorage.getItem("bingo_player_name");
    if (storedName) {
      setPlayerName(storedName);
    }

    const fetchRoom = async () => {
      const { data, error } = await supabase
        .from("xo_rooms")
        .select("*")
        .eq("id", roomId)
        .single();
      
      if (error) {
        console.error("Error fetching room:", error);
        setLoading(false);
        return;
      } 
      
      // Initialize target_time if P1 just created it
      if (data.status === 'waiting' && !data.target_time && data.player1_id === storedId) {
        const newTarget = Math.floor(Math.random() * 14) + 1;
        const board = Array(9).fill("");
        await supabase.from("xo_rooms").update({ target_time: newTarget, xo_board: board }).eq("id", roomId);
        data.target_time = newTarget;
        data.xo_board = board;
      }

      setRoom(data);
      
      if (data.status === 'waiting' && data.player1_id !== storedId && !data.player2_id) {
        if (storedName) {
          joinRoom(storedId, storedName, data.player1_id);
        } else {
          setNeedsName(true);
        }
      }
      setLoading(false);
    };

    fetchRoom();

    const channel = supabase
      .channel(`xo_room_${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "xo_rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          setRoom(payload.new as XORoom);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const joinRoom = async (pId: string, name: string, creatorId: string | null) => {
    const { error } = await supabase
      .from("xo_rooms")
      .update({ player2_id: pId, player2_name: name, status: "playing" }) 
      .eq("id", roomId)
      .is("player2_id", null);
    
    if (error) console.error("Error joining room:", error);
    else setNeedsName(false);
  };

  const handleJoinSubmit = () => {
    if (!playerName.trim() || !playerId || !room) return;
    localStorage.setItem("bingo_player_name", playerName.trim());
    joinRoom(playerId, playerName.trim(), room.player1_id);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startChallenge = () => {
    setLocalStart(Date.now());
    setIsCounting(true);
  };

  const stopChallenge = async () => {
    if (!localStart || !playerId || !room) return;
    const stopTime = Date.now();
    setIsCounting(false);
    
    const isP1 = room.player1_id === playerId;
    
    const updatePayload = isP1 
      ? { p1_start: localStart, p1_stop: stopTime }
      : { p2_start: localStart, p2_stop: stopTime };

    await supabase.from("xo_rooms").update(updatePayload).eq("id", roomId);
  };

  const handleCellClick = async (index: number) => {
    if (!room || !room.xo_board || !playerId || room.game_winner) return;
    if (room.xo_board[index] !== "") return; // Already filled

    const isP1 = room.player1_id === playerId;
    const isP2 = room.player2_id === playerId;
    
    // Check if we are in XO phase
    if (!room.p1_stop || !room.p2_stop || !room.target_time) return;

    // Check round winner
    const p1_diff = Math.abs((room.p1_stop - (room.p1_start || 0)) - room.target_time * 1000);
    const p2_diff = Math.abs((room.p2_stop - (room.p2_start || 0)) - room.target_time * 1000);
    
    const p1WinsRound = p1_diff <= p2_diff; // P1 wins on tie
    
    if ((isP1 && !p1WinsRound) || (isP2 && p1WinsRound)) {
      // Not your turn
      return;
    }

    const newBoard = [...room.xo_board];
    newBoard[index] = isP1 ? "X" : "O";

    // Check for game winner
    let winner = null;
    for (const line of WINNING_LINES) {
      const [a, b, c] = line;
      if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) {
        winner = isP1 ? 'P1' : 'P2';
        break;
      }
    }
    
    if (!winner && !newBoard.includes("")) {
      winner = "Draw";
    }

    if (winner) {
      await supabase.from("xo_rooms").update({ 
        xo_board: newBoard, 
        game_winner: winner,
        status: "finished"
      }).eq("id", roomId);
    } else {
      // Reset for next round
      const newTarget = Math.floor(Math.random() * 14) + 1;
      await supabase.from("xo_rooms").update({ 
        xo_board: newBoard,
        target_time: newTarget,
        p1_start: null,
        p1_stop: null,
        p2_start: null,
        p2_stop: null
      }).eq("id", roomId);
      setLocalStart(null); // Clear local state too just in case
    }
  };

  if (loading) {
    return <div className="text-neutral-400 animate-pulse text-center mt-10">جاري تحميل الغرفة...</div>;
  }

  if (!room) {
    return <div className="text-red-400 text-center mt-10">الغرفة غير موجودة أو حدث خطأ.</div>;
  }

  const handlePlayAgain = async () => {
    if (!room || !playerId) return;
    const newTarget = Math.floor(Math.random() * 14) + 1;
    await supabase.from("xo_rooms").update({ 
      xo_board: Array(9).fill(""),
      game_winner: null,
      status: "playing",
      target_time: newTarget,
      p1_start: null,
      p1_stop: null,
      p2_start: null,
      p2_stop: null
    }).eq("id", roomId);
  };

  if (needsName) {
    return (
      <div className="w-full max-w-md mx-auto space-y-6 mt-10 text-center bg-neutral-900/50 p-8 rounded-3xl border border-white/5 animate-fade-in-up">
        <h2 className="text-2xl font-bold text-white">انضم للغرفة</h2>
        <p className="text-neutral-400">يرجى إدخال اسمك للبدء باللعب</p>
        <input 
          type="text" 
          placeholder="أدخل اسمك هنا..."
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          maxLength={20}
          className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-center"
        />
        <button
          onClick={handleJoinSubmit}
          disabled={!playerName.trim()}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-all"
        >
          دخول
        </button>
      </div>
    );
  }

  const isPlayer1 = room.player1_id === playerId;
  const isPlayer2 = room.player2_id === playerId;
  const isSpectator = !isPlayer1 && !isPlayer2;

  // Derived state for the game
  const isChallengePhase = !room.p1_stop || !room.p2_stop;
  const isXoPhase = room.p1_stop && room.p2_stop && !room.game_winner;
  
  let p1WinsRound = false;
  let p1Diff = 0;
  let p2Diff = 0;
  let p1Actual = 0;
  let p2Actual = 0;
  
  if (isXoPhase && room.target_time) {
    p1Actual = (room.p1_stop! - (room.p1_start || 0)) / 1000;
    p2Actual = (room.p2_stop! - (room.p2_start || 0)) / 1000;
    p1Diff = Math.abs((room.p1_stop! - (room.p1_start || 0)) - room.target_time * 1000);
    p2Diff = Math.abs((room.p2_stop! - (room.p2_start || 0)) - room.target_time * 1000);
    p1WinsRound = p1Diff <= p2Diff;
  }

  const myStopSet = isPlayer1 ? !!room.p1_stop : isPlayer2 ? !!room.p2_stop : false;
  const opponentStopSet = isPlayer1 ? !!room.p2_stop : isPlayer2 ? !!room.p1_stop : false;

  return (
    <div className="w-full space-y-6 animate-fade-in-up">
      {/* Header Info */}
      <div className="bg-neutral-900/50 border border-white/5 p-6 rounded-3xl backdrop-blur-md relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>
        
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 relative z-10">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            {
              room.status === 'waiting' ? <><span className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse"></span> <span className="text-yellow-400">في انتظار لاعب...</span></> :
              room.status === 'playing' ? <><span className="w-3 h-3 rounded-full bg-emerald-400"></span> <span className="text-emerald-400">اللعب جاري</span></> :
              <><span className="w-3 h-3 rounded-full bg-red-400"></span> <span className="text-red-400">انتهت</span></>
            }
          </h2>
          <div className="flex gap-2">
            <button 
              onClick={copyLink}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl transition-all border border-white/5 text-sm"
            >
              {copied ? 'تم النسخ!' : 'انسخ رابط الغرفة'}
            </button>
            <button 
              onClick={() => router.push("/")}
              className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-xl transition-all border border-red-500/20 text-sm"
            >
              العودة للرئيسية
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-center relative z-10">
          <div className={`p-4 rounded-2xl transition-all ${isPlayer1 ? 'bg-indigo-500/20 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'bg-neutral-950/50 border border-white/5'}`}>
            <p className="text-sm text-neutral-400 mb-1">اللاعب الأول (X)</p>
            <p className="font-bold text-lg text-white truncate">{room.player1_name || 'غير معروف'}</p>
          </div>
          <div className={`p-4 rounded-2xl transition-all ${isPlayer2 ? 'bg-purple-500/20 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'bg-neutral-950/50 border border-white/5'}`}>
            <p className="text-sm text-neutral-400 mb-1">اللاعب الثاني (O)</p>
            <p className="font-bold text-lg text-white truncate">{room.player2_name || 'في الانتظار...'}</p>
          </div>
        </div>
      </div>

      {isSpectator && (
        <div className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 p-4 rounded-xl text-center shadow-lg">
          أنت تشاهد هذه الغرفة كمتفرج.
        </div>
      )}

      {/* Game Winner Announcer */}
      {room.game_winner && (
        <div className="bg-emerald-500/20 border border-emerald-500/50 p-8 rounded-3xl text-center shadow-[0_0_30px_rgba(16,185,129,0.2)] animate-bounce-subtle">
          <h2 className="text-4xl font-extrabold text-white mb-2">
            {room.game_winner === 'Draw' ? 'تعادل!' : `الفائز هو ${room.game_winner === 'P1' ? room.player1_name : room.player2_name} 🎉`}
          </h2>
          <p className="text-emerald-200 mb-6">العبوا مرة أخرى لكسر التعادل!</p>
          {(!isSpectator) && (
            <button 
              onClick={handlePlayAgain}
              className="bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-bold py-3 px-8 rounded-xl transition-transform hover:scale-105 active:scale-95 shadow-lg"
            >
              العب مرة أخرى
            </button>
          )}
        </div>
      )}

      {/* Main Game Logic UI */}
      {room.status === 'playing' && !isSpectator && !room.game_winner && (
        <div className="space-y-6">
          
          {/* Challenge Phase */}
          {isChallengePhase && (
            <div className="bg-neutral-900/80 border border-white/10 p-8 rounded-3xl text-center space-y-6">
              {!myStopSet ? (
                <>
                  <h3 className="text-xl text-neutral-400">تحدي الثواني</h3>
                  {!isCounting ? (
                    <div className="space-y-8">
                      <div className="text-8xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                        {room.target_time}
                      </div>
                      <p className="text-neutral-300">ثانية</p>
                      <button 
                        onClick={startChallenge}
                        className="w-full max-w-sm mx-auto bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-5 px-8 rounded-2xl text-xl shadow-lg transition-transform hover:scale-105 active:scale-95"
                      >
                        ابدأ العد الذهني
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-8 animate-fade-in">
                      <div className="text-3xl font-bold text-neutral-500 py-10">
                        الهدف مخفي... عد في ذهنك!
                      </div>
                      <button 
                        onClick={stopChallenge}
                        className="w-full max-w-sm mx-auto bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold py-5 px-8 rounded-2xl text-xl shadow-[0_0_20px_rgba(225,29,72,0.4)] transition-transform hover:scale-105 active:scale-95"
                      >
                        إيقاف الآن!
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-12 space-y-4">
                  <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />
                  <p className="text-xl text-emerald-400 font-medium">تم تسجيل وقتك بنجاح!</p>
                  <p className="text-neutral-400">في انتظار الخصم لإنهاء العد...</p>
                </div>
              )}
            </div>
          )}

          {/* XO Phase */}
          {isXoPhase && (
            <div className="bg-neutral-900/80 border border-white/10 p-8 rounded-3xl text-center space-y-8 animate-fade-in">
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white">الهدف ({room.target_time} ثانية)</h3>
                <div className="flex justify-center gap-8 text-lg mt-4">
                  <div className={`flex-1 p-4 rounded-2xl ${p1WinsRound ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-red-500/10 border border-red-500/20'}`}>
                    <p className="text-neutral-300 text-sm mb-1">{room.player1_name}</p>
                    <p className={`text-3xl font-bold mb-1 ${p1WinsRound ? 'text-emerald-400' : 'text-red-400'}`}>
                      {p1Actual.toFixed(3)}s
                    </p>
                    <p className={`text-sm ${p1WinsRound ? 'text-emerald-200/70' : 'text-red-200/70'}`}>الفرق: {(p1Diff / 1000).toFixed(3)}s</p>
                  </div>
                  <div className={`flex-1 p-4 rounded-2xl ${!p1WinsRound ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-red-500/10 border border-red-500/20'}`}>
                    <p className="text-neutral-300 text-sm mb-1">{room.player2_name}</p>
                    <p className={`text-3xl font-bold mb-1 ${!p1WinsRound ? 'text-emerald-400' : 'text-red-400'}`}>
                      {p2Actual.toFixed(3)}s
                    </p>
                    <p className={`text-sm ${!p1WinsRound ? 'text-emerald-200/70' : 'text-red-200/70'}`}>الفرق: {(p2Diff / 1000).toFixed(3)}s</p>
                  </div>
                </div>
                <div className="text-xl font-bold text-yellow-400 mt-4">
                  دور: {(p1WinsRound && isPlayer1) || (!p1WinsRound && isPlayer2) ? "أنت!" : "الخصم"}
                </div>
              </div>

              {/* Board */}
              <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
                {room.xo_board?.map((cell, idx) => {
                  const isMyTurn = (p1WinsRound && isPlayer1) || (!p1WinsRound && isPlayer2);
                  return (
                    <button
                      key={idx}
                      onClick={() => handleCellClick(idx)}
                      disabled={!isMyTurn || cell !== ""}
                      className={`
                        h-24 rounded-2xl text-5xl font-black transition-all flex items-center justify-center
                        ${cell === "X" ? "text-indigo-400 bg-indigo-500/10 border-2 border-indigo-500/30" : ""}
                        ${cell === "O" ? "text-purple-400 bg-purple-500/10 border-2 border-purple-500/30" : ""}
                        ${cell === "" ? "bg-neutral-950/50 border-2 border-white/5 hover:border-white/20" : ""}
                        ${cell === "" && isMyTurn ? "cursor-pointer hover:bg-white/5" : "cursor-not-allowed"}
                      `}
                    >
                      {cell}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}
      
      {/* Read Only Board for Spectators or Finished Games */}
      {(isSpectator || room.game_winner) && room.xo_board && (
         <div className="bg-neutral-900/80 border border-white/10 p-8 rounded-3xl text-center space-y-8 mt-6">
            <h3 className="text-xl text-neutral-400">لوحة اللعب</h3>
            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
              {room.xo_board.map((cell, idx) => (
                <div
                  key={idx}
                  className={`
                    h-24 rounded-2xl text-5xl font-black flex items-center justify-center
                    ${cell === "X" ? "text-indigo-400 bg-indigo-500/10 border-2 border-indigo-500/30" : ""}
                    ${cell === "O" ? "text-purple-400 bg-purple-500/10 border-2 border-purple-500/30" : ""}
                    ${cell === "" ? "bg-neutral-950/50 border-2 border-white/5" : ""}
                  `}
                >
                  {cell}
                </div>
              ))}
            </div>
         </div>
      )}

    </div>
  );
}
