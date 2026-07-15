"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";

type BingoBoardProps = {
  roomId: string;
  playerId: string;
  room: any;
};

export default function BingoBoard({ roomId, playerId, room }: BingoBoardProps) {
  const [board, setBoard] = useState<number[]>([]);
  const [lines, setLines] = useState(0);

  const prevSelectedLength = useRef(0);
  const prevStatus = useRef('waiting');

  const playSound = (type: 'pop' | 'win' | 'lose') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (type === 'pop') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'win') {
        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const startTime = ctx.currentTime + i * 0.1;
          gain.gain.setValueAtTime(0, startTime);
          gain.gain.linearRampToValueAtTime(0.5, startTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(startTime);
          osc.stop(startTime + 0.5);
        });
      } else if (type === 'lose') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const currentLength = room.selected_numbers?.length || 0;
    if (currentLength > prevSelectedLength.current) {
      playSound('pop');
    }
    prevSelectedLength.current = currentLength;
  }, [room.selected_numbers]);

  useEffect(() => {
    if (prevStatus.current === 'playing' && room.status === 'finished') {
      if (lines >= 5) playSound('win');
      else playSound('lose');
    }
    if (prevStatus.current === 'finished' && room.status === 'playing') {
      const newBoard = Array.from({ length: 25 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
      localStorage.setItem(`bingo_board_${roomId}`, JSON.stringify(newBoard));
      setBoard(newBoard);
      setLines(0);
    }
    prevStatus.current = room.status;
  }, [room.status, lines, roomId]);

  const handlePlayAgain = async () => {
    await supabase
      .from("rooms")
      .update({ 
        status: "playing",
        selected_numbers: [],
        current_turn: room.player1_id
      })
      .eq("id", roomId);
  };

  useEffect(() => {
    const saved = localStorage.getItem(`bingo_board_${roomId}`);
    if (saved) {
      setBoard(JSON.parse(saved));
    } else {
      const newBoard = Array.from({ length: 25 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
      localStorage.setItem(`bingo_board_${roomId}`, JSON.stringify(newBoard));
      setBoard(newBoard);
    }
  }, [roomId]);

  // حساب عدد الخطوط المكتملة
  useEffect(() => {
    if (board.length === 0 || !room.selected_numbers) return;
    const selected = room.selected_numbers;
    let count = 0;
    
    // الصفوف
    for (let r = 0; r < 5; r++) {
      if ([0,1,2,3,4].every(c => selected.includes(board[r*5 + c]))) count++;
    }
    // الأعمدة
    for (let c = 0; c < 5; c++) {
      if ([0,1,2,3,4].every(r => selected.includes(board[r*5 + c]))) count++;
    }
    // الأقطار
    if ([0,6,12,18,24].every(i => selected.includes(board[i]))) count++;
    if ([4,8,12,16,20].every(i => selected.includes(board[i]))) count++;

    setLines(count);

    // إذا أكمل 5 خطوط (BINGO)، ننهي اللعبة
    if (count >= 5 && room.status === 'playing') {
      supabase
        .from("rooms")
        .update({ status: "finished" })
        .eq("id", roomId)
        .then();
    }
  }, [board, room.selected_numbers, room.status, roomId]);

  const isMyTurn = room.current_turn === playerId;
  const otherPlayerId = room.player1_id === playerId ? room.player2_id : room.player1_id;

  const handleCellClick = async (num: number) => {
    if (!isMyTurn || room.status !== 'playing') return;
    if (room.selected_numbers?.includes(num)) return;

    const newSelected = [...(room.selected_numbers || []), num];
    
    await supabase
      .from("rooms")
      .update({ 
        selected_numbers: newSelected,
        current_turn: otherPlayerId 
      })
      .eq("id", roomId);
  };

  if (board.length === 0) return null;

  return (
    <div className="w-full max-w-md mx-auto space-y-6 animate-fade-in-up">
      <div className="flex flex-col items-center justify-center bg-neutral-900/50 p-6 rounded-3xl border border-white/5 space-y-6 shadow-inner">
        {/* BINGO Letters */}
        <div className="flex gap-3 sm:gap-4" dir="ltr">
          {["B", "I", "N", "G", "O"].map((letter, index) => {
            const isAchieved = lines > index;
            return (
              <span 
                key={index} 
                className={`
                  w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-2xl font-black text-3xl sm:text-4xl transition-all duration-500
                  ${isAchieved 
                    ? 'bg-indigo-500 text-white shadow-[0_0_25px_rgba(99,102,241,0.6)] scale-110' 
                    : 'bg-neutral-800 text-neutral-600 opacity-50'
                  }
                `}
              >
                {letter}
              </span>
            );
          })}
        </div>

        {/* Status Indicator */}
        <div className="text-center w-full">
          {room.status === 'playing' && (
            <div className={`inline-block px-8 py-3 rounded-full font-bold text-base sm:text-lg transition-all duration-300 ${isMyTurn ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 animate-pulse' : 'bg-neutral-800 text-neutral-400'}`}>
              {isMyTurn ? 'دورك الآن!' : 'انتظر دور الخصم...'}
            </div>
          )}
          {room.status === 'finished' && (
            <div className="flex flex-col items-center gap-4">
              <div className="px-8 py-3 rounded-full font-bold text-base sm:text-lg bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                {lines >= 5 ? 'لقد فزت! 🎉' : 'انتهت اللعبة! 😞'}
              </div>
              <button
                onClick={handlePlayAgain}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold text-lg transition-all border border-indigo-500/50 shadow-lg shadow-indigo-500/20 w-full max-w-xs"
              >
                إعادة اللعب
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-5 gap-2 sm:gap-3 p-4 bg-neutral-900/40 rounded-3xl border border-white/5 shadow-2xl">
        {board.map((num, i) => {
          const isSelected = room.selected_numbers?.includes(num);
          return (
            <button
              key={i}
              disabled={isSelected || !isMyTurn || room.status !== 'playing'}
              onClick={() => handleCellClick(num)}
              className={`
                aspect-square rounded-xl sm:rounded-2xl text-lg sm:text-2xl font-bold flex items-center justify-center
                transition-all duration-300 relative overflow-hidden
                ${isSelected 
                  ? 'bg-indigo-500 text-white scale-[0.97] shadow-inner border-transparent' 
                  : isMyTurn && room.status === 'playing'
                    ? 'bg-neutral-800 text-white hover:bg-neutral-700 hover:scale-[1.03] active:scale-95 cursor-pointer shadow-md border border-white/10'
                    : 'bg-neutral-800/50 text-neutral-500 cursor-not-allowed border border-white/5'
                }
              `}
            >
              {isSelected && (
                <span className="absolute inset-0 bg-white/20 animate-pulse" />
              )}
              <span className="relative z-10">{num}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
