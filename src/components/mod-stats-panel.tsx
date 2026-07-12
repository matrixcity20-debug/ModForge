import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetModStats } from "@/api/index";

export function ModStatsPanel() {
  const { data: stats, isLoading } = useGetModStats();

  if (isLoading) {
    return (
      <Card className="bg-zinc-950 text-zinc-50 border-zinc-800">
        <CardHeader>
          <Skeleton className="h-8 w-3/4 bg-zinc-800" />
          <Skeleton className="h-4 w-1/2 mt-2 bg-zinc-800" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full bg-zinc-800" />
          <Skeleton className="h-24 w-full bg-zinc-800" />
          <Skeleton className="h-24 w-full bg-zinc-800" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <Card className="bg-zinc-950 text-zinc-50 border-zinc-800 shadow-xl overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-orange-500 to-amber-500"></div>
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
          Atölye İstatistikleri
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Küresel mod üretim metrikleri
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800/50 flex flex-col items-center justify-center text-center">
          <span className="text-zinc-500 text-sm uppercase tracking-widest font-mono font-bold mb-1">Üretilen Modlar</span>
          <span className="text-4xl font-bold text-white tracking-tighter">{stats.totalMods.toLocaleString('tr-TR')}</span>
        </div>

        <div>
          <h4 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Yükleyiciye Göre</h4>
          <div className="grid grid-cols-2 gap-2">
            {stats.byLoader.map(bucket => {
              const variantMap: Record<string, string> = {
                forge: 'forge', fabric: 'fabric', neoforge: 'neoforge', quilt: 'quilt'
              };
              const variant = variantMap[bucket.label.toLowerCase()] || 'outline';
              return (
                <div key={bucket.label} className="bg-zinc-900/50 border border-zinc-800 rounded p-2 flex justify-between items-center">
                  <Badge variant={variant as any} className="capitalize text-[10px]">{bucket.label}</Badge>
                  <span className="font-mono text-sm text-zinc-300">{bucket.count}</span>
                </div>
              );
            })}
            {stats.byLoader.length === 0 && (
              <div className="col-span-2 text-sm text-zinc-600 italic">Henüz veri yok</div>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">En Çok Kullanılan Sürümler</h4>
          <div className="space-y-2">
            {stats.byVersion.slice(0, 5).map(bucket => (
              <div key={bucket.label} className="flex items-center text-sm">
                <span className="font-mono text-zinc-300 w-16">{bucket.label}</span>
                <div className="flex-1 ml-2 h-2 bg-zinc-900 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-zinc-600 rounded-full" 
                    style={{ width: `${Math.max(2, (bucket.count / stats.totalMods) * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-zinc-500 ml-3 w-8 text-right">{bucket.count}</span>
              </div>
            ))}
            {stats.byVersion.length === 0 && (
              <div className="text-sm text-zinc-600 italic">Henüz veri yok</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
