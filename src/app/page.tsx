"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [gameMode, setGameMode] = useState<'classic' | 'envy'>('classic');

  useEffect(() => {
    let storedId = localStorage.getItem("bingo_player_id");
    if (!storedId) {
      storedId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
      localStorage.setItem("bingo_player_id", storedId);
    }
    setPlayerId(storedId);

    const storedName = localStorage.getItem("bingo_player_name");
    if (storedName) setPlayerName(storedName);
  }, []);

  const handleCreateRoom = async () => {
    if (!playerId || !playerName.trim()) return;
    setIsCreating(true);
    localStorage.setItem("bingo_player_name", playerName.trim());

    try {
      const { data, error } = await supabase
        .from("rooms")
        .insert([{ player1_id: playerId, player1_name: playerName.trim(), status: "waiting", mode: gameMode }])
        .select()
        .single();

      if (error) throw error;

      if (data && data.id) {
        router.push(`/game/${data.id}`);
      }
    } catch (error: any) {
      console.error("Error creating room:", error);
      alert("حدث خطأ: " + (error?.message || error?.details || JSON.stringify(error)));
      setIsCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-white font-sans selection:bg-indigo-500/30" dir="rtl">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-neutral-950 to-neutral-950 -z-10" />
      
      <div className="max-w-md w-full flex flex-col items-center space-y-10">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-neutral-500 drop-shadow-sm">
            بينجو
          </h1>
          <p className="text-neutral-400 text-lg">
            مرحباً بك في اللعبة. أدخل اسمك وقم بإنشاء غرفة للبدء.
          </p>
        </div>

        <div className="w-full space-y-4">
          <input 
            type="text" 
            placeholder="أدخل اسمك هنا..."
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={20}
            className="w-full bg-neutral-900/50 border border-white/10 rounded-2xl px-6 py-4 text-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-center transition-all"
          />

          <div className="flex rounded-2xl bg-neutral-900/50 border border-white/10 overflow-hidden p-1">
            <button
              onClick={() => setGameMode('classic')}
              className={`flex-1 py-3 text-center rounded-xl font-bold transition-all ${gameMode === 'classic' ? 'bg-indigo-600 text-white shadow-md' : 'text-neutral-500 hover:text-white'}`}
            >
              كلاسيكي 🎲
            </button>
            <button
              onClick={() => setGameMode('envy')}
              className={`flex-1 py-3 text-center rounded-xl font-bold transition-all ${gameMode === 'envy' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-500 hover:text-white'}`}
            >
              الحسد 👁️
            </button>
          </div>

          <button
            onClick={handleCreateRoom}
            disabled={isCreating || !playerName.trim()}
            className={`
              relative group overflow-hidden rounded-2xl p-[1px] w-full
              transition-all duration-300 ease-out
              focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-neutral-950
              ${(isCreating || !playerName.trim()) ? 'opacity-60 cursor-not-allowed scale-95' : 'hover:scale-105 active:scale-95'}
            `}
          >
            <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-70 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
            <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
            
            <div className="relative bg-neutral-950/80 backdrop-blur-xl px-8 py-4 rounded-2xl flex items-center justify-center gap-3 w-full h-full border border-white/10 transition-colors group-hover:bg-neutral-950/50">
              {isCreating ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              )}
              <span className="font-semibold text-lg text-white">
                {isCreating ? "جاري الإنشاء..." : "إنشاء غرفة جديدة"}
              </span>
            </div>
          </button>
        </div>
      </div>
    </main>
  );
}
