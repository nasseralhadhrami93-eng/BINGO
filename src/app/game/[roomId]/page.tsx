import RoomClient from "@/components/game/RoomClient";

export default async function GameRoom({ params }: { params: Promise<{ roomId: string }> }) {
  const resolvedParams = await params;
  
  return (
    <main className="min-h-screen bg-neutral-950 flex flex-col items-center p-6 font-sans" dir="rtl">
      <div className="max-w-4xl w-full space-y-8 mt-10">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-neutral-500">
            غرفة اللعب
          </h1>
        </div>

        <RoomClient roomId={resolvedParams.roomId} />
      </div>
    </main>
  );
}
