import React from 'react';
import { ModGenerationForm } from "@/components/mod-generation-form";
import { ModHistoryList } from "@/components/mod-history-list";
import { ModStatsPanel } from "@/components/mod-stats-panel";

export default function Home() {
  return (
    <div className="min-h-[100dvh] bg-background">
      
      {/* Header */}
      <header className="bg-zinc-950 text-white border-b border-zinc-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center font-bold text-xl shadow-[0_0_15px_rgba(255,87,34,0.4)]">
              M
            </div>
            <span className="font-bold text-xl tracking-tight">Mod<span className="text-primary font-mono ml-0.5">Forge</span></span>
          </div>
          <div className="font-mono text-xs text-zinc-500 bg-zinc-900 px-3 py-1 rounded border border-zinc-800">
            SİSTEM.AKTİF
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Left Column: Form */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-8">
            <section>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 leading-tight">
                Bir sonraki <br/><span className="text-primary">Minecraft Modunuzu</span> Tasarlayın
              </h1>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl leading-relaxed">
                Mekaniklerinizi, eşyalarınızı ve kurallarınızı açıklayın. Yapay zeka mühendislik motorumuz eksiksiz bir plan, dosya yapısı ve uygulama kodu üretecektir.
              </p>
              
              <ModGenerationForm />
            </section>
          </div>

          {/* Right Column: Sidebar */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-8">
            <ModStatsPanel />
            <ModHistoryList />
          </div>

        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t py-8 mt-12 bg-zinc-50 dark:bg-zinc-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 opacity-50">
             <div className="w-5 h-5 bg-zinc-500 rounded flex items-center justify-center font-bold text-white text-xs">
              M
            </div>
            <span className="font-bold tracking-tight text-zinc-500">ModForge</span>
          </div>
          <p className="text-sm text-zinc-500 font-mono">
            Yapay Zeka Tarafından Desteklenmektedir
          </p>
        </div>
      </footer>
    </div>
  );
}
