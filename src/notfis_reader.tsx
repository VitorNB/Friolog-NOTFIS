import React, { useState } from 'react';
import { Upload, FileText, Package, AlertCircle, CheckCircle2 } from 'lucide-react';

// --- ESTILOS VISUAIS (CSS-in-JS) ---
const fixedStyles = `
.container-shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
.text-indigo-600 { color: #4f46e5; }
.text-green-600 { color: #10b981; }
.text-blue-600 { color: #2563eb; }
.bg-indigo-50 { background-color: #eef2ff; }
.bg-green-50 { background-color: #ecfdf5; }
.bg-blue-50 { background-color: #eff6ff; }
.bg-table-header { background-color: #f9fafb; }
.table-data-cubagem { background-color: #eef2ff; color: #4f46e5; font-weight: 600; }
.table-row-hover:hover { background-color: #f9fafb; }
.grid-cols-3 { display: grid; grid-template-columns: repeat(1, minmax(0, 1fr)); gap: 1rem; }
@media (min-width: 768px) { .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.border-dashed-upload { border: 2px dashed #a5b4fc; background-color: #eef2ff; }
`;

// --- INTERFACES DE DADOS ---
interface Destinatario {
  razaoSocial: string;
  cnpjCpf: string;
  cidade: string;
  estado: string;
}

interface Embarcadora {
  razaoSocial: string;
  cnpj: string;
}

interface NotaFiscal {
  numeroNF: string;
  serie: string;
  dataEmissao: string;
  embarcadora: Embarcadora | null;
  destinatario: Destinatario | null;
  qtdeVolumes: number;
  valorTotal: number;
  pesoTotal: number;
  cubagem: number;
  chaveAcesso?: string;
}

const NotfisReader = () => {
  const [fileData, setFileData] = useState<string | null>(null);
  const [notasFiscais, setNotasFiscais] = useState<NotaFiscal[]>([]);
  const [error, setError] = useState<string | null>(null);

  /**
   * Função para reconstruir linhas quebradas incorretamente.
   */
  const reconstructLines = (rawContent: string): string[] => {
    const rawLines = rawContent.replace(/\r/g, '').split('\n');
    const fixedLines: string[] = [];
    
    // IDs padrão do NOTFIS
    const validIds = ['000', '310', '311', '312', '313', '314', '316', '317', '318', '319', '333'];
    
    let currentLineBuffer = '';

    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        const potentialId = line.substring(0, 3);

        if (validIds.includes(potentialId)) {
            if (currentLineBuffer) {
                fixedLines.push(currentLineBuffer);
            }
            currentLineBuffer = line;
        } else {
            if (line.trim().length > 0) {
                currentLineBuffer += line; 
            }
        }
    }
    if (currentLineBuffer) fixedLines.push(currentLineBuffer);

    return fixedLines;
  };

  const parseNotfis = (content: string) => {
    const lines = reconstructLines(content);
    const notas: NotaFiscal[] = [];
    
    let currentEmbarcadora: Embarcadora | null = null;
    let currentDestinatario: Destinatario | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length < 3) continue;

      const registroId = line.substring(0, 3);

      // --- REGISTRO 311: DADOS DA EMBARCADORA ---
      if (registroId === '311') {
        currentEmbarcadora = {
          cnpj: line.substring(3, 17).trim(), 
          razaoSocial: line.substring(133, 173).trim()
        };
      }

      // --- REGISTRO 312: DADOS DO DESTINATÁRIO ---
      if (registroId === '312') {
        currentDestinatario = {
          razaoSocial: line.substring(3, 43).trim(),
          cnpjCpf: line.substring(43, 57).trim(),
          cidade: line.substring(132, 167).trim(),
          estado: line.substring(185, 194).trim()
        };
      }

      // --- REGISTRO 313: DADOS DA NOTA FISCAL ---
      if (registroId === '313') {
        if (line.length < 120) continue; 

        const serie = line.substring(29, 32).trim();
        const numeroNF = line.substring(32, 40).trim();
        const dataEmissao = line.substring(40, 48).trim();
        
        const qtdeVolumesStr = line.substring(78, 85).trim();
        const qtdeVolumes = qtdeVolumesStr ? parseFloat(qtdeVolumesStr) / 100 : 0;
        
        const valorTotalStr = line.substring(85, 100).trim();
        const valorTotal = valorTotalStr ? parseFloat(valorTotalStr) / 100 : 0;
        
        const pesoTotalStr = line.substring(100, 107).trim();
        const pesoTotal = pesoTotalStr ? parseFloat(pesoTotalStr) / 100 : 0;
        
        const cubagemStr = line.substring(107, 112).trim();
        const cubagem = cubagemStr ? parseFloat(cubagemStr) / 100 : 0;

        let chaveAcesso = '';
        if (line.length >= 298) {
            chaveAcesso = line.substring(254, 298).trim();
        }

        if (currentEmbarcadora && currentDestinatario) {
            notas.push({
              numeroNF,
              serie,
              dataEmissao,
              embarcadora: { ...currentEmbarcadora },
              destinatario: { ...currentDestinatario },
              qtdeVolumes,
              valorTotal,
              pesoTotal,
              cubagem,
              chaveAcesso
            });
            currentDestinatario = null;
        }
      }
    }
    return notas;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setNotasFiscais([]);

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result;
        if (typeof content !== 'string') throw new Error("Falha ao ler conteúdo do arquivo.");

        const notas = parseNotfis(content);

        if (notas.length === 0) {
          setError('Nenhuma nota fiscal encontrada. Verifique se o arquivo segue o padrão NOTFIS 3.0A.');
        } else {
          setNotasFiscais(notas);
          setFileData(file.name);
        }
      } catch (err: any) {
        setError('Erro no processamento: ' + err.message);
      }
    };

    reader.onerror = () => setError('Erro de leitura do arquivo.');
    
    // Leitura em ISO-8859-1 para suportar arquivos legados
    reader.readAsText(file, 'ISO-8859-1');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    return `${dateStr.substring(0, 2)}/${dateStr.substring(2, 4)}/${dateStr.substring(4, 8)}`;
  };

  const totalCubagem = notasFiscais.reduce((sum, n) => sum + n.cubagem, 0);
  const totalValor = notasFiscais.reduce((sum, n) => sum + n.valorTotal, 0);

  return (
    <>
      <style>{fixedStyles}</style>
      <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #eff6ff, #e0e7ff)', padding: '1.5rem', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column' }}>
        <div style={{ maxWidth: '90rem', margin: '0 auto', width: '100%', flex: 1 }}>
          
          {/* Header e Upload */}
          <div className="container-shadow-lg" style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <Package style={{ width: '2rem', height: '2rem', color: '#4f46e5' }} />
              <div>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>Leitor NOTFIS 3.0A</h1>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>Validador e extrator de dados conforme manual oficial</p>
              </div>
            </div>

            <div className="border-dashed-upload" style={{ borderRadius: '0.5rem', padding: '2rem', textAlign: 'center' }}>
              <Upload style={{ width: '3rem', height: '3rem', color: '#4f46e5', margin: '0 auto 1rem' }} />
              <label style={{ cursor: 'pointer', display: 'inline-block' }}>
                <span style={{ fontSize: '1.125rem', fontWeight: '600', color: '#4f46e5' }}>
                  Carregar Arquivo .TXT
                </span>
                <input type="file" accept=".txt" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>

            {fileData && (
              <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#4b5563' }}>
                <FileText style={{ width: '1rem', height: '1rem' }} />
                <span>Arquivo carregado: <strong>{fileData}</strong></span>
                <span style={{ marginLeft: 'auto', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckCircle2 size={16} /> Processamento Concluído
                </span>
              </div>
            )}

            {error && (
              <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '0.5rem', display: 'flex', gap: '0.75rem' }}>
                <AlertCircle style={{ width: '1.25rem', height: '1.25rem', color: '#dc2626' }} />
                <p style={{ color: '#991b1b', margin: 0 }}>{error}</p>
              </div>
            )}
          </div>

          {/* Resultados */}
          {notasFiscais.length > 0 && (
            <>
              {/* KPIs (Indicadores) */}
              <div className="container-shadow-lg" style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#374151' }}>Totais do Arquivo</h2>
                <div className="grid-cols-3">
                  <div className="bg-indigo-50" style={{ borderRadius: '0.5rem', padding: '1rem' }}>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Notas</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }} className="text-indigo-600">{notasFiscais.length}</p>
                  </div>
                  <div className="bg-green-50" style={{ borderRadius: '0.5rem', padding: '1rem' }}>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cubagem (m³)</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }} className="text-green-600">{totalCubagem.toFixed(3)}</p>
                  </div>
                  <div className="bg-blue-50" style={{ borderRadius: '0.5rem', padding: '1rem' }}>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor da Carga</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }} className="text-blue-600">
                      {formatCurrency(totalValor)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabela Detalhada */}
              <div className="container-shadow-lg" style={{ backgroundColor: 'white', borderRadius: '0.5rem', overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>Detalhamento das Notas (Registro 313)</h2>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Mostrando {notasFiscais.length} registros</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead className="bg-table-header">
                      <tr>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>NF / Série</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Emissão</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Destinatário</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Vol.</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Peso (kg)</th>
                        <th className="table-data-cubagem" style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Cub. (m³)</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Valor</th>
                      </tr>
                    </thead>
                    <tbody style={{ borderTop: '1px solid #e5e7eb' }}>
                      {notasFiscais.map((nota, index) => (
                        <tr key={index} className="table-row-hover" style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: '500', color: '#111827' }}>
                            {nota.numeroNF} <span style={{color: '#9ca3af', fontSize: '0.75em'}}>/ {nota.serie}</span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#4b5563' }}>{formatDate(nota.dataEmissao)}</td>
                          <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>
                             <div style={{fontWeight: '500'}}>{nota.destinatario?.razaoSocial}</div>
                             <div style={{fontSize: '0.75rem', color: '#6b7280'}}>
                                {nota.destinatario?.cidade} - {nota.destinatario?.estado}
                             </div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#374151' }}>{nota.qtdeVolumes.toFixed(0)}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#374151' }}>{nota.pesoTotal.toFixed(2)}</td>
                          <td className="table-data-cubagem" style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{nota.cubagem.toFixed(3)}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#374151', fontWeight: '500' }}>{formatCurrency(nota.valorTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* RODAPÉ DO PROJETO */}
          <footer style={{ textAlign: 'center', marginTop: '3rem', marginBottom: '1.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
            <p>Criado por <strong>Vitor Nogueira</strong></p>
          </footer>

        </div>
      </div>
    </>
  );
};

export default NotfisReader;