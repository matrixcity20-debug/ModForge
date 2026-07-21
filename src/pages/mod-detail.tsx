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
import {
  ArrowLeft, Trash2, Clock, Terminal, AlertCircle,
  FileCode2, PackageCheck, Loader2, Cpu, Hammer, Download,
  CheckCircle2, XCircle, ChevronDown, MessageSquare, X,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ModChat } from '@/components/mod-chat';

// ─── Build durumu ──────────────────────────────────────────────────────────────

type BuildStatus = 'idle' | 'building' | 'success' | 'error';

interface BuildState {
  status: BuildStatus;
  logs: string[];
  jarToken: string | null;
  jarFilename: string | null;
  errorMessage: string | null;
}

// ─── Bileşen ──────────────────────────────────────────────────────────────────

export default function ModDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const id = Number(params.id);

  // Kaynak ZIP indirme
  const [isDownloading, setIsDownloading] = React.useState(false);

  // Chat paneli
  const [chatOpen, setChatOpen] = React.useState(false);

  // Sunucu derleme
  const [buildDialogOpen, setBuildDialogOpen] = React.useState(false);
  const [build, setBuild] = React.useState<BuildState>({
    status: 'idle',
    logs: [],
    jarToken: null,
    jarFilename: null,
    errorMessage: null,
  });
  const logEndRef = React.useRef<HTMLDivElement>(null);
  const esRef = React.useRef<EventSource | null>(null);

  // Log'lar güncellenince aşağı kaydır
  React.useEffect(() => {
    if (buildDialogOpen) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [build.logs, buildDialogOpen]);

  // Dialog kapanırsa EventSource'u temizle
  React.useEffect(() => {
    if (!buildDialogOpen && esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, [buildDialogOpen]);

  // ─── Kaynak ZIP indir ──────────────────────────────────────────────────────

  const handleDownloadSource = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/mods/${id}/download`);
      if (!res.ok) throw new Error('İndirme başarısız');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('content-disposition') ?? '';
      const nameMatch = disposition.match(/filename="([^"]+)"/);
      a.download = nameMatch ? nameMatch[1] : `mod-${id}-source.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'İndirme başarısız', variant: 'destructive' });
    } finally {
      setIsDownloading(false);
    }
  };

  // ─── Sunucu derleme başlat ─────────────────────────────────────────────────

  const handleStartBuild = () => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }

    setBuild({ status: 'building', logs: [], jarToken: null, jarFilename: null, errorMessage: null });
    setBuildDialogOpen(true);

    const es = new EventSource(`/api/mods/${id}/compile`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as
          | { type: 'log'; message: string }
          | { type: 'ready'; token: string; filename: string }
          | { type: 'fail'; message: string };

        if (event.type === 'log') {
          setBuild((prev) => ({ ...prev, logs: [...prev.logs, event.message] }));
        } else if (event.type === 'ready') {
          es.close();
          esRef.current = null;
          setBuild((prev) => ({
            ...prev,
            status: 'success',
            jarToken: event.token,
            jarFilename: event.filename,
            logs: [...prev.logs, `✅ Derleme tamamlandı: ${event.filename}`],
          }));
        } else if (event.type === 'fail') {
          es.close();
          esRef.current = null;
          setBuild((prev) => ({
            ...prev,
            status: 'error',
            errorMessage: event.message,
            logs: [...prev.logs, `❌ HATA: ${event.message}`],
          }));
        }
      } catch {
        // JSON parse hatası — yoksay
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setBuild((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: 'Sunucu bağlantısı kesildi.',
        logs: [...prev.logs, '❌ Sunucu bağlantısı kesildi.'],
      }));
    };
  };

  // ─── Derlenmiş .jar indir ──────────────────────────────────────────────────

  const handleDownloadJar = async () => {
    if (!build.jarToken) return;
    try {
      const res = await fetch(`/api/mods/${id}/jar/${build.jarToken}`);
      if (!res.ok) throw new Error('İndirme süresi dolmuş veya hata oluştu');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = build.jarFilename ?? `mod-${id}.jar`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: '✅ .jar indirildi!' });
    } catch (err) {
      toast({
        title: 'İndirme başarısız',
        description: err instanceof Error ? err.message : 'Bilinmeyen hata',
        variant: 'destructive',
      });
    }
  };

  // ─── Sorgu ────────────────────────────────────────────────────────────────

  const { data: mod, isLoading, error } = useGetModRequest(id, {
    query: {
      enabled: !!id,
      queryKey: getGetModRequestQueryKey(id),
      refetchInterval: (query) => {
        const status = (query.state.data as { status?: string } | undefined)?.status;
        return status === 'pending' ? 3000 : false;
      },
    },
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
      },
    });
  };

  // ─── Yükleniyor / Hata ────────────────────────────────────────────────────

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
        <Link href="/" className={buttonVariants({ variant: 'default' })}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Atölyeye Dön
        </Link>
      </div>
    );
  }

  const isPending = mod.status === 'pending';
  const isFailed  = mod.status === 'failed' || mod.status === 'refused';
  const isCompleted = mod.status === 'completed';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">

      {/* ── Üst bar ──────────────────────────────────────────────────────── */}
      <header className="bg-zinc-950 text-white border-b border-zinc-800 sticky top-0 z-20 shrink-0">
        <div className="max-w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-zinc-400 hover:text-white transition-colors flex items-center">
              <ArrowLeft className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline font-mono text-sm uppercase tracking-wider">Geri</span>
            </Link>
            <div className="h-6 w-px bg-zinc-800" />
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-primary" />
              <span className="font-mono text-sm font-bold">{mod.id.toString().padStart(4, '0')}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isCompleted && (
              <>
                {/* Kaynak ZIP indirme */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownloadSource}
                  disabled={isDownloading}
                  className="font-mono text-xs uppercase tracking-wider text-zinc-400 hover:text-white"
                >
                  <FileCode2 className="w-4 h-4 mr-1" />
                  {isDownloading ? 'Hazırlanıyor...' : 'Kaynak ZIP'}
                </Button>

                {/* Sunucu derleme */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartBuild}
                  disabled={build.status === 'building'}
                  className="font-mono text-xs uppercase tracking-wider border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
                >
                  {build.status === 'building' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Hammer className="w-4 h-4 mr-2" />
                  )}
                  {build.status === 'building' ? 'Derleniyor...' : '.jar\'a Derle'}
                </Button>

                {/* AI Sohbet butonu */}
                <Button
                  variant={chatOpen ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChatOpen((v) => !v)}
                  className={cn(
                    'font-mono text-xs uppercase tracking-wider',
                    chatOpen
                      ? ''
                      : 'border-primary/50 text-primary hover:bg-primary hover:text-white',
                  )}
                >
                  {chatOpen
                    ? <><X className="w-4 h-4 mr-2" />Sohbeti Kapat</>
                    : <><MessageSquare className="w-4 h-4 mr-2" />AI ile Geliştir</>
                  }
                </Button>
              </>
            )}

            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteMod.isPending}
              className="font-mono text-xs uppercase tracking-wider"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Yok Et
            </Button>
          </div>
        </div>
      </header>

      {/* ── Split layout: içerik + chat ───────────────────────────────────── */}
      <div className={cn('flex flex-1 overflow-hidden', chatOpen ? 'flex-row' : 'flex-col')}>

        {/* ── Ana içerik ──────────────────────────────────────────────────── */}
        <div
          className={cn(
            'overflow-y-auto pb-16',
            chatOpen ? 'flex-1 min-w-0' : 'w-full',
          )}
        >
          <main className={cn(
            'px-4 sm:px-6 lg:px-8 py-8 sm:py-12',
            chatOpen ? 'max-w-full' : 'max-w-5xl mx-auto',
          )}>
            <div className="mb-8">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Badge
                  variant={isPending ? 'secondary' : isFailed ? 'destructive' : 'success'}
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
                {mod.title || 'İsimsiz Plan'}
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
                    <div className="h-full bg-primary rounded-full animate-[progress_2s_ease-in-out_infinite]" style={{ width: '60%' }} />
                  </div>
                  <p className="text-[11px] text-zinc-600 mt-4">Bu sayfa üretim tamamlanınca otomatik güncellenecek.</p>
                </div>
              )}

              {isFailed && (
                <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-6 flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-lg mb-1">Plan Üretimi Başarısız</h3>
                    <p className="opacity-90">{mod.summary || 'Atölye bu isteği işlerken bir hatayla karşılaştı.'}</p>
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

        {/* ── Chat paneli ──────────────────────────────────────────────────── */}
        {chatOpen && (
          <div className="w-full sm:w-[420px] lg:w-[480px] shrink-0 flex flex-col overflow-hidden border-l border-zinc-800">
            <ModChat modId={id} />
          </div>
        )}
      </div>

      {/* ── Derleme ilerleme dialogu ──────────────────────────────────────── */}
      <Dialog open={buildDialogOpen} onOpenChange={setBuildDialogOpen}>
        <DialogContent className="max-w-2xl w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono">
              {build.status === 'building' && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
              {build.status === 'success'  && <CheckCircle2 className="w-5 h-5 text-green-500" />}
              {build.status === 'error'    && <XCircle className="w-5 h-5 text-red-500" />}
              {build.status === 'idle'     && <Hammer className="w-5 h-5" />}
              Sunucu Derlemesi
            </DialogTitle>
          </DialogHeader>

          {/* Log alanı */}
          <ScrollArea className="h-72 w-full rounded-md border bg-zinc-950 p-3 font-mono text-xs">
            {build.logs.map((line, i) => (
              <div
                key={i}
                className={cn(
                  'leading-relaxed whitespace-pre-wrap break-all',
                  line.startsWith('✅') || line.startsWith('✓') ? 'text-green-400' :
                  line.startsWith('❌') || line.startsWith('⚠') ? 'text-red-400' :
                  line.startsWith('🤖') ? 'text-yellow-400' :
                  line.startsWith('🔨') || line.startsWith('🔧') ? 'text-blue-400' :
                  'text-zinc-300',
                )}
              >
                {line}
              </div>
            ))}
            {build.status === 'building' && (
              <div className="flex items-center gap-2 text-zinc-500 mt-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>çalışıyor...</span>
              </div>
            )}
            <div ref={logEndRef} />
          </ScrollArea>

          {/* Durum çubuğu */}
          {build.status === 'building' && (
            <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-[progress_2s_ease-in-out_infinite]" style={{ width: '60%' }} />
            </div>
          )}

          {/* Başarı */}
          {build.status === 'success' && build.jarToken && (
            <div className="flex flex-col items-center gap-3 py-2">
              <p className="text-sm text-zinc-500 font-mono">{build.jarFilename}</p>
              <Button
                onClick={handleDownloadJar}
                className="w-full font-mono text-sm uppercase tracking-wider"
              >
                <Download className="w-4 h-4 mr-2" />
                .jar'ı İndir
              </Button>
              <p className="text-[11px] text-zinc-500">İndirme linki 30 dakika geçerlidir.</p>
            </div>
          )}

          {/* Hata */}
          {build.status === 'error' && (
            <div className="rounded-lg bg-red-950/40 border border-red-900 p-4 text-sm text-red-300">
              <p className="font-bold mb-1">Derleme başarısız</p>
              <p className="opacity-80">{build.errorMessage}</p>
              <p className="mt-3 text-xs text-zinc-500">
                Kaynak ZIP'i indirip yerel ortamınızda derleyebilirsiniz.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
