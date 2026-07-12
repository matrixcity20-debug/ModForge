import React, { useState } from 'react';
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCreateModRequest, ModRequestInputModLoader } from "@/api/index";
import { useQueryClient } from "@tanstack/react-query";
import { getListModRequestsQueryKey, getGetModStatsQueryKey } from "@/api/index";
import { useLocation } from "wouter";
import { Hammer, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const formSchema = z.object({
  mcVersion: z.string().min(1, "Minecraft sürümü gereklidir").regex(/^\d+\.\d+(\.\d+)?$/, "Geçerli bir sürüm formatı olmalıdır (örn. 1.20.1)"),
  modLoader: z.nativeEnum(ModRequestInputModLoader),
  prompt: z.string().min(10, "Modunuzu biraz daha detaylı açıklayın (en az 10 karakter)").max(4000, "Açıklama çok uzun"),
});

type FormValues = z.infer<typeof formSchema>;

const commonVersions = [
  "1.21.4", "1.21.3", "1.21.2", "1.21.1", "1.21",
  "1.20.6", "1.20.5", "1.20.4", "1.20.3", "1.20.2", "1.20.1", "1.20",
  "1.19.4", "1.19.3", "1.19.2", "1.19.1", "1.19",
  "1.18.2", "1.18.1", "1.18",
  "1.17.1",
  "1.16.5",
];

export function ModGenerationForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMod = useCreateModRequest();
  const [, setLocation] = useLocation();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mcVersion: "1.20.1",
      modLoader: "forge",
      prompt: "",
    },
  });

  function onSubmit(data: FormValues) {
    setErrorMsg(null);
    createMod.mutate({ data }, {
      onSuccess: (mod) => {
        queryClient.invalidateQueries({ queryKey: getListModRequestsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetModStatsQueryKey() });
        form.reset();
        setLocation(`/mods/${mod.id}`);
      },
      onError: (err: any) => {
        const errorMessage = err.data?.error || "Mod üretilemedi. Lütfen tekrar deneyin.";
        setErrorMsg(errorMessage);
      }
    });
  }

  return (
    <Card className="border-2 border-zinc-200 dark:border-zinc-800 shadow-md">
      <CardHeader className="bg-zinc-50 dark:bg-zinc-900/50 border-b pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <Hammer className="w-6 h-6" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">Atölye</CardTitle>
            <CardDescription className="text-base mt-1">Hayalinizdeki modu anlatın, biz mühendisliğini yapalım.</CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
        {errorMsg && (
          <Alert variant="destructive" className="mb-6 bg-destructive/10 text-destructive border-destructive/20">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Atölye Hatası</AlertTitle>
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="mcVersion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono uppercase tracking-wider text-xs font-bold text-zinc-500">Minecraft Sürümü</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="font-mono bg-zinc-50 dark:bg-zinc-900">
                          <SelectValue placeholder="Sürüm seçin" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {commonVersions.map(v => (
                          <SelectItem key={v} value={v} className="font-mono">{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="modLoader"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono uppercase tracking-wider text-xs font-bold text-zinc-500">Mod Yükleyici</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900">
                          <SelectValue placeholder="Yükleyici seçin" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="forge">Forge</SelectItem>
                        <SelectItem value="fabric">Fabric</SelectItem>
                        <SelectItem value="neoforge">NeoForge</SelectItem>
                        <SelectItem value="quilt">Quilt</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-baseline mb-2">
                    <FormLabel className="font-mono uppercase tracking-wider text-xs font-bold text-zinc-500">Mod Açıklaması</FormLabel>
                    <span className="text-[10px] text-zinc-400 font-mono">{field.value.length}/4000</span>
                  </div>
                  <FormControl>
                    <Textarea 
                      placeholder="örn. Ateş topları fırlatan, alev çubuğu ve elmasla yapılan sihirli bir asa istiyorum..." 
                      className="min-h-[160px] resize-y bg-zinc-50 dark:bg-zinc-900 leading-relaxed"
                      disabled={createMod.isPending}
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Mekanikler, eşyalar ve üretim tarifleri hakkında spesifik olun.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" size="lg" className="w-full font-bold tracking-wide text-lg h-14" disabled={createMod.isPending}>
              {createMod.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Gönderiliyor...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Modu Üret
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
