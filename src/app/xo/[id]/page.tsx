import XORoomClient from "@/components/game/xo/XORoomClient";

export default async function XORoom({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  return (
    <main className="min-h-screen bg-neutral-950 flex flex-col items-center p-6 font-sans" dir="rtl">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-neutral-950 to-neutral-950 -z-10" />
      <div className="max-w-4xl w-full space-y-8 mt-10">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-emerald-500">
            تحدي XO الذهني
          </h1>
        </div>

        <XORoomClient roomId={resolvedParams.id} />
      </div>
    </main>
  );
}
