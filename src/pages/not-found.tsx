import React from 'react';
import { Link } from 'wouter';
import { buttonVariants } from '@/components/ui/button';
import { ArrowLeft, Map } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center text-center p-4">
      <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-900 rounded-2xl flex items-center justify-center mb-6">
        <Map className="w-10 h-10 text-zinc-400" />
      </div>
      <h1 className="text-4xl font-bold tracking-tight mb-3">Keşfedilmemiş Bölge</h1>
      <p className="text-lg text-zinc-500 mb-8 max-w-md">
        Aradığınız chunk henüz oluşturulmadı ya da boşlukta kayboldu.
      </p>
      <Link href="/" className={cn(buttonVariants({ size: "lg" }), "font-bold tracking-wide")}>
        <ArrowLeft className="w-5 h-5 mr-2" />
        Üsse Dön
      </Link>
    </div>
  );
}
