"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import BingoBoard from "./BingoBoard";

type Room = {
  id: string;
  created_at: string;
  player1_id: string | null;
  player2_id: string | null;
  player1_name: string | null;
  player2_name: string | null;
  status: string;
  selected_numbers: number[] | null;
  current_turn: string | null;
  mode: 'classic' | 'envy';
  blocked_numbers: number[] | null;
  envy_used_by: string[] | null;
};

export default function RoomClient({ roomId }: { roomId: string }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [needsName, setNeedsName] = useState(false);
  const [copied, setCopied] = useState(false);

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
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .single();
      
      if (error) {
        console.error("Error fetching room:", error);
        setLoading(false);
        return;
      } 
      
      setRoom(data);
      
      // If we are not the creator, and the room is waiting, we should join
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
      .channel(`room_${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          setRoom(payload.new as Room);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const joinRoom = async (pId: string, name: string, creatorId: string | null) => {
    const { error } = await supabase
      .from("rooms")
      .update({ player2_id: pId, player2_name: name, status: "playing", current_turn: creatorId }) 
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

  if (loading) {
    return <div className="text-neutral-400 animate-pulse text-center mt-10">جاري تحميل الغرفة...</div>;
  }

  if (!room) {
    return <div className="text-red-400 text-center mt-10">الغرفة غير موجودة أو حدث خطأ.</div>;
  }

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
          className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-center"
        />
        <button
          onClick={handleJoinSubmit}
          disabled={!playerName.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-all"
        >
          دخول
        </button>
      </div>
    );
  }

  const isPlayer1 = room.player1_id === playerId;
  const isPlayer2 = room.player2_id === playerId;
  const isSpectator = !isPlayer1 && !isPlayer2;

  return (
    <div className="w-full space-y-6 animate-fade-in-up">
      {/* Room Status Indicator */}
      <div className="bg-neutral-900/50 border border-white/5 p-6 rounded-3xl backdrop-blur-md relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
        
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 relative z-10">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            {
              room.status === 'waiting' ? <><span className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse"></span> <span className="text-yellow-400">في انتظار لاعب...</span></> :
              room.status === 'playing' ? <><span className="w-3 h-3 rounded-full bg-green-400"></span> <span className="text-green-400">اللعب جاري</span></> :
              <><span className="w-3 h-3 rounded-full bg-red-400"></span> <span className="text-red-400">انتهت</span></>
            }
          </h2>
          <button 
            onClick={copyLink}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl transition-all border border-white/5 text-sm"
          >
            {copied ? (
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            )}
            {copied ? 'تم النسخ!' : 'انسخ رابط الغرفة'}
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-center relative z-10">
          <div className={`p-4 rounded-2xl transition-all ${isPlayer1 ? 'bg-indigo-500/20 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'bg-neutral-950/50 border border-white/5'}`}>
            <p className="text-sm text-neutral-400 mb-1">اللاعب الأول {isPlayer1 && '(أنت)'}</p>
            <p className="font-bold text-lg text-white truncate">{room.player1_name || 'غير معروف'}</p>
          </div>
          <div className={`p-4 rounded-2xl transition-all ${isPlayer2 ? 'bg-purple-500/20 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'bg-neutral-950/50 border border-white/5'}`}>
            <p className="text-sm text-neutral-400 mb-1">اللاعب الثاني {isPlayer2 && '(أنت)'}</p>
            <p className="font-bold text-lg text-white truncate">{room.player2_name || 'في الانتظار...'}</p>
          </div>
        </div>
      </div>

      {isSpectator && (
        <div className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 p-4 rounded-xl text-center shadow-lg">
          أنت تشاهد هذه الغرفة كمتفرج.
        </div>
      )}
      
      {/* Bingo Board */}
      {!isSpectator && playerId && (
        <BingoBoard roomId={roomId} playerId={playerId} room={room} />
      )}
    </div>
  );
}
