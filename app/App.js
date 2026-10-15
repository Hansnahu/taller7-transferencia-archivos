// =============================================================
//  Taller Practico - Tema 7
//  Transferencia de Archivos y Sincronizacion Asincrona
//
//  Funciona en DOS entornos:
//   - Dispositivo (Expo Go / Android / iOS): usa expo-file-system,
//     descarga a un archivo real y reanuda con HTTP Range.
//   - Web (navegador / vista web de Snack): usa fetch + Range
//     (expo-file-system NO existe en web).
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

const isWeb = Platform.OS === 'web';

// -----------------------------------------------------------
//  Estado en memoria para la version web (el navegador no tiene
//  acceso al sistema de archivos nativo como el celular).
// -----------------------------------------------------------
let webBytes = 0;
let webAbortController = null;

export default function App() {
  const [progress, setProgress] = useState(0); // 0.0 a 1.0
  const [status, setStatus] = useState('Inactivo');
  const [downloading, setDownloading] = useState(false);

  const downloadResumableRef = useRef(null); // objeto reanudable (nativo)
  const downloadedBytesRef = useRef(0);      // bytes ya descargados (nativo)

  const LOCAL_FILE_URI = isWeb
    ? ''
    : FileSystem.documentDirectory + 'downloaded-file.zip';

  // ---------------------------------------------------------
  //  Actualiza progreso y estado a partir de bytes escritos
  // ---------------------------------------------------------
  const setProgressFrom = (written, total) => {
    const p = total > 0 ? written / total : 0;
    setProgress(p);
    setStatus(`Descargando stream: ${(p * 100).toFixed(1)}%`);
  };

  // =========================================================
  //  NATIVO (Expo Go / Android / iOS)
  // =========================================================
  const nativeMakeProgressCallback = (alreadyDownloaded) => (downloadProgress) => {
    const totalExpected =
      downloadProgress.totalBytesExpectedToWrite + alreadyDownloaded;
    const currentWritten =
      downloadProgress.totalBytesWritten + alreadyDownloaded;
    setProgressFrom(currentWritten, totalExpected);
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

  const nativeResume = async () => {
    if (downloadResumableRef.current) {
      await downloadResumableRef.current.resumeAsync(
        nativeMakeProgressCallback(downloadedBytesRef.current)
      );
    } else {
      await nativeStart(true); // no hay objeto reanudable: reanuda desde el archivo
    }
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
      setProgressFrom(received, total);
    }
  };

  const webPause = () => {
    if (webAbortController) webAbortController.abort();
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
      } else if (resume) {
        await nativeResume();
      } else {
        await nativeStart(false);
      }

      setDownloading(false);
      setStatus(
        resume ? '¡Reanudación completada!' : '¡Descarga binaria finalizada con éxito!'
      );
      setProgress(1);
    } catch (error) {
      setDownloading(false);
      if (isWeb && error && error.name === 'AbortError') {
        setStatus('Descarga pausada. Presiona "Reanudar" para continuar.');
      } else {
        setStatus(`Flujo interrumpido: ${error.message}`);
      }
    }
  };

  const startDownload = () => runDownload(false);
  const resumeDownload = () => runDownload(true);

  // ---------------------------------------------------------
  //  Verifica si el archivo ya existe (nativo) o su tamano (web)
  // ---------------------------------------------------------
  const checkFile = async () => {
    try {
      if (isWeb) {
        const mb = webBytes / (1024 * 1024);
        alert(`Archivo en memoria (web): ${mb.toFixed(2)} MB de 20.00 MB`);
        return;
      }
      let fileInfo = await FileSystem.getInfoAsync(LOCAL_FILE_URI);
      if (fileInfo.exists) {
        const sizeInMB = fileInfo.size / (1024 * 1024);
        alert(`¡El archivo existe! ${sizeInMB.toFixed(2)} MB\n`);
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
      <Text style={styles.platform}>{isWeb ? 'Modo: Navegador (web)' : 'Modo: Dispositivo'}</Text>

      <Text style={styles.status}>Estado: {status}</Text>

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
        style={[styles.button, styles.resumeButton]}
        onPress={resumeDownload}
        disabled={downloading}
      >
        <Text style={styles.buttonText}>Reanudar Descarga (Range)</Text>
      </TouchableOpacity>

      {isWeb && (
        <TouchableOpacity
          style={[styles.button, styles.pauseButton]}
          onPress={webPause}
          disabled={!downloading}
        >
          <Text style={styles.buttonText}>Pausar (solo web)</Text>
        </TouchableOpacity>
      )}

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
  status: { fontSize: 15, marginBottom: 10, textAlign: 'center' },
  spinner: { marginVertical: 10 },
  progressText: { fontSize: 40, fontWeight: 'bold', color: '#4CAF50', marginVertical: 15 },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 12,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  resumeButton: { backgroundColor: '#FF9800' },
  pauseButton: { backgroundColor: '#9C27B0' },
  checkButton: { backgroundColor: '#607D8B' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
