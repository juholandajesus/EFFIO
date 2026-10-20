import { useState, useRef } from "react";
import { Upload, File, AlertCircle, CheckCircle2, FileUp } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetConsumoHorarioQueryKey, getGetDashboardQueryKey, getGetDiagnosticoQueryKey, UploadResult } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function UploadCsv() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === "text/csv") {
      setFile(selected);
      setResult(null);
      setError(null);
    } else {
      setError("Por favor, selecione um arquivo CSV válido.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && (dropped.type === "text/csv" || dropped.name.endsWith(".csv"))) {
      setFile(dropped);
      setResult(null);
      setError(null);
    } else {
      setError("Por favor, solte um arquivo CSV válido.");
    }
  };

  const clearFile = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(10);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);

      const response = await fetch('/api/upload-csv', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        throw new Error("Falha no upload do arquivo.");
      }

      const data = await response.json() as UploadResult;
      setResult(data);
      
      // Invalidate queries that depend on consumption data
      queryClient.invalidateQueries({ queryKey: getGetConsumoHorarioQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDiagnosticoQueryKey() });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocorreu um erro desconhecido.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload de Dados CCEE</h1>
        <p className="text-muted-foreground mt-1">Importe arquivos CSV com o consumo horário das empresas.</p>
      </div>

      <Card className="border-primary/20 shadow-sm">
        <CardHeader>
          <CardTitle>Selecionar Arquivo</CardTitle>
          <CardDescription>
            Faça upload do relatório de consumo horário exportado da CCEE (formato .csv)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!file ? (
            <div 
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              data-testid="dropzone"
            >
              <div className="flex justify-center mb-4">
                <div className="bg-primary/10 p-4 rounded-full">
                  <FileUp className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-2">Clique para selecionar ou arraste o arquivo</h3>
              <p className="text-sm text-muted-foreground">Suporta apenas arquivos CSV (máx. 50MB)</p>
            </div>
          ) : (
            <div className="border rounded-xl p-6 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/20 p-3 rounded-lg text-primary">
                    <File className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{file.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                {!isUploading && !result && (
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); clearFile(); }} data-testid="button-remove-file">
                    Remover
                  </Button>
                )}
              </div>
              
              {isUploading && (
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Processando dados...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}
            </div>
          )}
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".csv,text/csv" 
            className="hidden" 
            data-testid="input-file"
          />

          {error && (
            <Alert variant="destructive" className="mt-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro no Upload</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert className={`mt-6 ${result.status === 'sucesso' ? 'border-green-500/50 bg-green-50/50' : 'border-amber-500/50 bg-amber-50/50'}`}>
              {result.status === 'sucesso' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
              <AlertTitle className="flex items-center gap-2">
                Processamento Concluído
                <Badge variant={result.status === 'sucesso' ? 'default' : 'secondary'} className={result.status === 'sucesso' ? 'bg-green-600 hover:bg-green-700' : ''}>
                  {result.status.toUpperCase()}
                </Badge>
              </AlertTitle>
              <AlertDescription className="mt-2">
                <p className="font-medium text-foreground">{result.processadas} registros processados com sucesso.</p>
                {result.erros && result.erros.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-semibold mb-1">Avisos ({result.erros.length}):</p>
                    <ul className="list-disc pl-5 text-sm space-y-1 text-muted-foreground max-h-32 overflow-y-auto">
                      {result.erros.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="bg-muted/30 border-t justify-end py-4">
          {result ? (
            <Button onClick={clearFile} variant="outline" data-testid="button-new-upload">
              Novo Upload
            </Button>
          ) : (
            <Button 
              onClick={handleUpload} 
              disabled={!file || isUploading}
              className="min-w-[150px]"
              data-testid="button-upload"
            >
              {isUploading ? (
                "Processando..."
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" /> Importar Dados
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
