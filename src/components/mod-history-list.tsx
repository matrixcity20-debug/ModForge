import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useListModRequests } from "@/api/index";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { Link } from "wouter";
import { ArrowRight, Clock, FileCode2, Zap, AlertCircle } from "lucide-react";

export function ModHistoryList() {
  const { data: mods, isLoading } = useListModRequests();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="font-mono text-sm uppercase tracking-wider text-zinc-500 font-bold mb-4">Son Projeler</h3>
        {[1, 2, 3].map(i => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-4 flex gap-4">
              <Skeleton className="h-16 w-16 rounded" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!mods || mods.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="font-mono text-sm uppercase tracking-wider text-zinc-500 font-bold mb-4">Son Projeler</h3>
        <Card className="bg-zinc-50 dark:bg-zinc-900/30 border-dashed">
          <CardContent className="p-8 text-center text-zinc-500">
            <FileCode2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>Henüz hiç mod üretilmedi.</p>
            <p className="text-sm mt-1">İlk üreten siz olun!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-mono text-sm uppercase tracking-wider text-zinc-500 font-bold mb-4 flex items-center justify-between">
        <span>Son Projeler</span>
        <Badge variant="secondary" className="font-mono">{mods.length}</Badge>
      </h3>
      
      <div className="space-y-3">
        {mods.map(mod => {
          const isFailed = mod.status === 'failed' || mod.status === 'refused';
          
          return (
            <Link key={mod.id} href={`/mods/${mod.id}`} className="block group">
              <Card className={`transition-all duration-200 hover:border-primary/50 hover:shadow-md ${isFailed ? 'opacity-70 grayscale' : ''}`}>
                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center">
                  
                  <div className={`hidden sm:flex shrink-0 h-12 w-12 rounded-lg items-center justify-center ${isFailed ? 'bg-zinc-200 dark:bg-zinc-800' : 'bg-primary/10 text-primary'}`}>
                    {isFailed ? <AlertCircle className="w-6 h-6 text-zinc-500" /> : <Zap className="w-6 h-6" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-bold text-lg truncate group-hover:text-primary transition-colors">
                        {mod.title || "İsimsiz Mod"}
                      </h4>
                      <div className="shrink-0 text-xs text-zinc-400 flex items-center font-mono">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatDistanceToNow(new Date(mod.createdAt), { addSuffix: true, locale: tr })}
                      </div>
                    </div>
                    
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-1 mb-3">
                      {mod.summary || mod.prompt}
                    </p>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider bg-zinc-50 dark:bg-zinc-900">
                        {mod.mcVersion}
                      </Badge>
                      <Badge 
                        variant={
                          mod.modLoader === 'forge' ? 'forge' : 
                          mod.modLoader === 'fabric' ? 'fabric' : 
                          mod.modLoader === 'neoforge' ? 'neoforge' : 'quilt'
                        } 
                        className="font-mono text-[10px] uppercase tracking-wider"
                      >
                        {mod.modLoader}
                      </Badge>
                      
                      {isFailed && (
                        <Badge variant="destructive" className="font-mono text-[10px] uppercase ml-auto">
                          {mod.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="hidden sm:flex shrink-0 items-center justify-center text-zinc-300 group-hover:text-primary transition-colors group-hover:translate-x-1 duration-200">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
