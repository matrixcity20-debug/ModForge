import React from 'react';
import { useParams, Link, useLocation } from 'wouter';
import {
  useGetModRequest,
  getGetModRequestQueryKey,
  useDeleteModRequest,
  getListModRequestsQueryKey,
  getGetModStatsQueryKey,
} from '@/api/api';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ArrowLeft, Trash2, Clock, Terminal, AlertCircle, FileCode2, PackageCheck, Loader2, Cpu } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

export default function ModDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const id = Number(params.id);
  const [isDownloading, setIsDownloading] = React.useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/mods/${id}/download`);
      if (!res.ok) throw new Error("İndirme başarısız");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("content-disposition") ?? "";
      const nameMatch = disposition.match(/filename="([^"]+)"/);
      a.download = nameMatch ? nameMatch[1] : `mod-${id}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "İndirme başarısız", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const { data: mod, isLoading, error } = useGetModRequest(id, {
    query: {
      enabled: !!id,
      queryKey: getGetModRequestQueryKey(id),
      refetchInterval: (query) => {
        const status = (query.state.data as { status?: string } | undefined)?.status;
        return status === 'pending' ? 3000 : false;
      },
    }
  });

  const deleteMod = useDeleteModRequest();

  const handleDelete = () => {
    if (!confirm('Bu mod planını kalıcı olarak yok etmek istiyor musunuz?')) return;

    deleteMod.mutate({ id }, {
      onSuccess: () => {
        toast({ title: 'Plan yok edildi' });
        queryClient.invalidateQueries({ queryKey: getListModRequestsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetModStatsQueryKey() });
        setLocation('/');
      },
      onError: () => {
        toast({ title: 'Plan yok edilemedi', variant: 'destructive' });
      }
    });
  };

  if (isLoading) {
     return (
        <div className="min-h-[100dvh] bg-background">
           <header className="bg-zinc-950 text-white border-b border-zinc-800 h-16 flex items-center px-4 md:px-8">
              <Skeleton className="h-6 w-24 bg-zinc-800" />
           </header>
           <main className="max-w-5xl mx-auto px-4 py-12 space-y-8">
             <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-16 w-full" />
             </div>
             <Skeleton className="h-96 w-full mt-12" />
           </main>
        </div>
     );
  }

  if (error || !mod) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center text-center p-4">
         <AlertCircle className="w-16 h-16 text-zinc-500 mb-4 opacity-50" />
         <h1 className="text-2xl font-bold mb-2">Plan Bulunamadı</h1>
         <p className="text-zinc-500 mb-6">Bu mod isteği silinmiş ya da hiç var olmamış olabilir.</p>
         <Link href="/" className={buttonVariants({ variant: "default" })}>
           <ArrowLeft className="w-4 h-4 mr-2" /> Atölyeye Dön
         </Link>
      </div>
    );
  }

  const isPending = mod.status === 'pending';
  const isFailed = mod.status === 'failed' || mod.status === 'refused';

  return (
    <div className="min-h-[100dvh] bg-background pb-16">
      <header className="bg-zinc-950 text-white border-b border-zinc-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-zinc-400 hover:text-white transition-colors flex items-center">
              <ArrowLeft className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline font-mono text-sm uppercase tracking-wider">Geri</span>
            </Link>
            <div className="h-6 w-px bg-zinc-800"></div>
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-primary" />
              <span className="font-mono text-sm font-bold">{mod.id.toString().padStart(4, '0')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mod?.status === 'completed' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={isDownloading}
                className="font-mono text-xs uppercase tracking-wider border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
              >
                <PackageCheck className="w-4 h-4 mr-2" />
                {isDownloading ? "Hazırlanıyor..." : ".jar'a Çevir"}
              </Button>
            )}
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteMod.isPending} className="font-mono text-xs uppercase tracking-wider">
              <Trash2 className="w-4 h-4 mr-2" />
              Yok Et
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge
              variant={isPending ? "secondary" : isFailed ? "destructive" : "success"}
              className="font-mono text-[10px] uppercase tracking-wider"
            >
              {isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin inline" />}
              {mod.status}
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
              MC {mod.mcVersion}
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
            <div className="ml-auto flex items-center text-xs text-zinc-500 font-mono">
              <Clock className="w-3 h-3 mr-1" />
              {formatDistanceToNow(new Date(mod.createdAt), { addSuffix: true, locale: tr })}
            </div>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">
            {mod.title || "İsimsiz Plan"}
          </h1>

          <Card className="bg-zinc-50 dark:bg-zinc-900/50 border-dashed mb-8">
            <CardContent className="p-6">
              <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-500 font-bold mb-2">Orijinal İstem</h3>
              <p className="text-zinc-700 dark:text-zinc-300 italic">"{mod.prompt}"</p>
            </CardContent>
          </Card>

          {mod.summary && !isFailed && (
            <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
              {mod.summary}
            </p>
          )}

          {isPending && (
            <div className="bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-xl p-8 font-mono">
              <div className="flex items-center gap-3 mb-6">
                <Cpu className="w-6 h-6 text-primary animate-pulse" />
                <span className="text-primary font-bold text-lg">Yapay Zeka Motoru Çalışıyor</span>
              </div>
              <div className="space-y-2 text-sm text-zinc-400 mb-6">
                <p>▸ Mod mimarisi tasarlanıyor...</p>
                <p>▸ Java kodu üretiliyor...</p>
                <p>▸ Dosya yapısı oluşturuluyor...</p>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-primary rounded-full animate-[progress_2s_ease-in-out_infinite]" style={{width: '60%'}} />
              </div>
              <p className="text-[11px] text-zinc-600 mt-4">Bu sayfa üretim tamamlanınca otomatik güncellenecek.</p>
            </div>
          )}

          {isFailed && (
            <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-6 flex items-start gap-4">
              <AlertCircle className="w-6 h-6 shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg mb-1">Plan Üretimi Başarısız</h3>
                <p className="opacity-90">{mod.summary || "Atölye bu isteği işlerken bir hatayla karşılaştı."}</p>
              </div>
            </div>
          )}
        </div>

        {mod.resultMarkdown && (
          <div className="mt-12 space-y-6">
            <h3 className="flex items-center text-xl font-bold tracking-tight border-b pb-4">
              <FileCode2 className="w-5 h-5 mr-3 text-primary" />
              Üretilen Mimari
            </h3>
            <div className="bg-card rounded-xl border p-6 sm:p-8 shadow-sm overflow-x-auto">
              <MarkdownRenderer content={mod.resultMarkdown} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
