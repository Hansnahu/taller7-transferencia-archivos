// =============================================================
//  Taller Practico - Tema 7
//  Transferencia de Archivos y Sincronizacion Asincrona
//
//  Reanudacion correcta:
//   - Dispositivo (Expo Go): expo-file-system con pauseAsync()/resumeAsync()
//   - Web (navegador): fetch + HTTP Range desde el byte recibido
//
//  IMPORTANTE: para reanudar hay que PAUSAR primero. Asi la reanudacion
//  continua desde donde se quedo y NO vuelve a empezar de cero.
// =============================================================

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import React, { useState, useRef } from 'react';
import * as FileSystem from 'expo-file-system/legacy'; // SDK 54+: la API clasica vive en /legacy

// -----------------------------------------------------------
//  CONFIGURACION: URL del backend Flask en el Codespace
// -----------------------------------------------------------
const FILE_URL =
  'https://obscure-parakeet-4jgx567xx6qf55xg-4000.app.github.dev/large-sample-file.zip';

const TOTAL_MB = 20;
const isWeb = Platform.OS === 'web';

// Estado en memoria para la version web (el navegador no escribe en disco).
let webBytes = 0;
let webAbortController = null;

export default function App() {
  const [progress, setProgress] = useState(0);      // 0.0 a 1.0
  const [status, setStatus] = useState('Inactivo');
  const [downloading, setDownloading] = useState(false);
  const [downloadedMB, setDownloadedMB] = useState(0);

  const downloadResumableRef = useRef(null);        // objeto reanudable (nativo)
  const downloadedBytesRef = useRef(0);             // bytes ya descargados antes de esta sesion
  const pausedRef = useRef(false);                  // true si el usuario pauso

  const LOCAL_FILE_URI = isWeb
    ? ''
    : FileSystem.documentDirectory + 'downloaded-file.zip';

  // ---------------------------------------------------------
  //  Actualiza progreso a partir de bytes escritos / total
  // ---------------------------------------------------------
  const updateProgress = (written, total) => {
    const p = total > 0 ? Math.min(written / total, 1) : 0;
    setProgress(p);
    setDownloadedMB(written / (1024 * 1024));
    setStatus(`Descargando stream: ${(p * 100).toFixed(1)}%`);
  };

  // =========================================================
  //  NATIVO (Expo Go / Android / iOS)
  // =========================================================
  const nativeMakeProgressCallback = (alreadyDownloaded) => (downloadProgress) => {
    const total = downloadProgress.totalBytesExpectedToWrite + alreadyDownloaded;
    const written = downloadProgress.totalBytesWritten + alreadyDownloaded;
    updateProgress(written, total);
  };

  const nativeStart = async (resume) => {
    let fileInfo = await FileSystem.getInfoAsync(LOCAL_FILE_URI);
    let downloadedBytes = fileInfo.exists && resume ? fileInfo.size : 0;

    // Si NO reanudamos y el archivo existe, se borra y empieza de cero
    if (!resume && fileInfo.exists) {
      await FileSystem.deleteAsync(LOCAL_FILE_URI, { idempotent: true });
      downloadedBytes = 0;
    }
    downloadedBytesRef.current = downloadedBytes;

    downloadResumableRef.current = FileSystem.createDownloadResumable(
      FILE_URL,
      LOCAL_FILE_URI,
      { headers: downloadedBytes > 0 ? { Range: `bytes=${downloadedBytes}-` } : {} },
      nativeMakeProgressCallback(downloadedBytes)
    );

    await downloadResumableRef.current.downloadAsync();
  };

  // =========================================================
  //  WEB (navegador) -> fetch + Range
  // =========================================================
  const webDownload = async (resume) => {
    const startByte = resume ? webBytes : 0;
    if (!resume) webBytes = 0;

    webAbortController = new AbortController();
    const response = await fetch(FILE_URL, {
      headers: startByte > 0 ? { Range: `bytes=${startByte}-` } : {},
      signal: webAbortController.signal,
    });

    if (response.status !== 200 && response.status !== 206) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentLength = Number(response.headers.get('Content-Length')) || 0;
    const total = startByte + contentLength;

    const reader = response.body.getReader();
    let received = startByte;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      webBytes = received;
      updateProgress(received, total);
    }
  };

  // =========================================================
  //  ACCIONES COMUNES
  // =========================================================
  const runDownload = async (resume) => {
    setDownloading(true);
    setStatus(resume ? 'Reanudando...' : 'Iniciando transferencia...');

    try {
      if (isWeb) {
        await webDownload(resume);
      } else if (resume && pausedRef.current && downloadResumableRef.current) {
        // Continua EXACTAMENTE donde se pauso
        await downloadResumableRef.current.resumeAsync(
          nativeMakeProgressCallback(downloadedBytesRef.current)
        );
      } else {
        // Sin pausa previa: arranca (o reanuda desde el archivo en disco)
        await nativeStart(resume);
      }

      setDownloading(false);
      if (pausedRef.current) {
        setStatus('Descarga pausada. Presiona "Reanudar Descarga".');
      } else {
        setStatus(
          resume ? '¡Reanudación completada!' : '¡Descarga binaria finalizada con éxito!'
        );
        setProgress(1);
        setDownloadedMB(TOTAL_MB);
      }
    } catch (error) {
      setDownloading(false);
      if (pausedRef.current || (isWeb && error && error.name === 'AbortError')) {
        setStatus('Descarga pausada. Presiona "Reanudar Descarga".');
      } else {
        setStatus(`Flujo interrumpido: ${error.message}`);
      }
    }
  };

  const startDownload = () => {
    pausedRef.current = false;
    runDownload(false);
  };

  const resumeDownload = () => runDownload(true);

  const pauseDownload = async () => {
    pausedRef.current = true;
    if (isWeb) {
      if (webAbortController) webAbortController.abort();
    } else if (downloadResumableRef.current) {
      try {
        await downloadResumableRef.current.pauseAsync();
      } catch (e) {
        // ignorar
      }
    }
  };

  // ---------------------------------------------------------
  //  Verifica el tamano descargado
  // ---------------------------------------------------------
  const checkFile = async () => {
    try {
      if (isWeb) {
        alert(`Archivo en memoria (web): ${downloadedMB.toFixed(2)} MB de ${TOTAL_MB}.00 MB`);
        return;
      }
      let fileInfo = await FileSystem.getInfoAsync(LOCAL_FILE_URI);
      if (fileInfo.exists) {
        const sizeInMB = fileInfo.size / (1024 * 1024);
        alert(`¡El archivo existe! ${sizeInMB.toFixed(2)} MB`);
        console.log('Información del archivo:', fileInfo);
      } else {
        alert('El archivo todavía no ha sido descargado.');
      }
    } catch (error) {
      console.error('Error al verificar el archivo:', error);
    }
  };

  // ---------------------------------------------------------
  //  Interfaz
  // ---------------------------------------------------------
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gestor de Descargas (Python Backend)</Text>
      <Text style={styles.platform}>
        {isWeb ? 'Modo: Navegador (web)' : 'Modo: Dispositivo'}
      </Text>

      <Text style={styles.status}>Estado: {status}</Text>
      <Text style={styles.downloaded}>
        Descargado: {downloadedMB.toFixed(2)} MB / {TOTAL_MB}.00 MB
      </Text>

      {downloading && (
        <ActivityIndicator size="small" color="#4CAF50" style={styles.spinner} />
      )}

      <Text style={styles.progressText}>{(progress * 100).toFixed(1)}%</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={startDownload}
        disabled={downloading}
      >
        <Text style={styles.buttonText}>Iniciar Descarga</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.pauseButton]}
        onPress={pauseDownload}
        disabled={!downloading}
      >
        <Text style={styles.buttonText}>Pausar Descarga</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.resumeButton]}
        onPress={resumeDownload}
        disabled={downloading}
      >
        <Text style={styles.buttonText}>Reanudar Descarga (Range)</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.checkButton]}
        onPress={checkFile}
      >
        <Text style={styles.buttonText}>Verificar Archivo</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 4, textAlign: 'center' },
  platform: { fontSize: 13, color: '#607D8B', marginBottom: 12 },
  status: { fontSize: 15, marginBottom: 4, textAlign: 'center' },
  downloaded: { fontSize: 13, color: '#455A64', marginBottom: 8 },
  spinner: { marginVertical: 6 },
  progressText: { fontSize: 40, fontWeight: 'bold', color: '#4CAF50', marginVertical: 12 },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 10,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  pauseButton: { backgroundColor: '#9C27B0' },
  resumeButton: { backgroundColor: '#FF9800' },
  checkButton: { backgroundColor: '#607D8B' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
