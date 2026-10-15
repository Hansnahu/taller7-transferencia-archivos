// =============================================================
//  Taller Practico - Tema 7
//  App Expo (Snack) que muestra el progreso de la transferencia
//  y permite REANUDAR la descarga usando HTTP Range.
// =============================================================

import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import React, { useState, useRef } from 'react';
import * as FileSystem from 'expo-file-system';

// -----------------------------------------------------------
//  CONFIGURACION
//  Reemplaza esta URL por la de tu Codespace:
//    pestana "Ports" -> puerto 4000 -> visibilidad "Public"
//    y copia el enlace terminado en:  /large-sample-file.zip
// -----------------------------------------------------------
const FILE_URL =
  'https://obscure-parakeet-4jgx567xx6qf55xg-4000.app.github.dev/large-sample-file.zip';

export default function App() {
  const [progress, setProgress] = useState(0);          // 0.0 a 1.0
  const [status, setStatus] = useState('Inactivo');
  const [downloading, setDownloading] = useState(false);

  const downloadResumableRef = useRef(null);            // objeto reanudable
  const downloadedBytesRef = useRef(0);                 // bytes ya descargados

  const LOCAL_FILE_URI = FileSystem.documentDirectory + 'downloaded-file.zip';

  // -----------------------------------------------------------
  //  Callback de progreso (suma los bytes previos si es reanudacion)
  // -----------------------------------------------------------
  const makeProgressCallback = (alreadyDownloaded) => (downloadProgress) => {
    const totalExpected =
      downloadProgress.totalBytesExpectedToWrite + alreadyDownloaded;
    const currentWritten =
      downloadProgress.totalBytesWritten + alreadyDownloaded;
    const currentProgress = totalExpected > 0 ? currentWritten / totalExpected : 0;

    setProgress(currentProgress);
    setStatus(`Descargando stream: ${(currentProgress * 100).toFixed(1)}%`);
  };

  // -----------------------------------------------------------
  //  Inicia la descarga. resume=true -> continua donde quedo.
  // -----------------------------------------------------------
  const startDownload = async (resume = false) => {
    setDownloading(true);
    setStatus('Iniciando transferencia...');

    try {
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
        {
          headers:
            downloadedBytes > 0 ? { Range: `bytes=${downloadedBytes}-` } : {},
        },
        makeProgressCallback(downloadedBytes)
      );

      const result = await downloadResumableRef.current.downloadAsync();

      setDownloading(false);
      setStatus('¡Descarga binaria finalizada con éxito!');
      setProgress(1);
    } catch (error) {
      setDownloading(false);
      setStatus(`Flujo interrumpido: ${error.message}`);
    }
  };

  // -----------------------------------------------------------
  //  Reanuda la descarga en curso.
  //  Si aun no hay ningun objeto reanudable, arranca en modo resume.
  // -----------------------------------------------------------
  const resumeDownload = async () => {
    setDownloading(true);
    setStatus('Reanudando...');

    try {
      if (downloadResumableRef.current) {
        await downloadResumableRef.current.resumeAsync(
          makeProgressCallback(downloadedBytesRef.current)
        );
      } else {
        await startDownload(true);
        return;
      }

      setDownloading(false);
      setStatus('¡Reanudación completada!');
      setProgress(1);
    } catch (error) {
      setDownloading(false);
      setStatus(`Error al reanudar: ${error.message}`);
    }
  };

  // -----------------------------------------------------------
  //  Verifica si el archivo ya existe en el dispositivo
  // -----------------------------------------------------------
  const checkFile = async () => {
    try {
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

  // -----------------------------------------------------------
  //  Interfaz
  // -----------------------------------------------------------
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gestor de Descargas (Python Backend)</Text>

      <Text style={styles.status}>Estado: {status}</Text>

      {downloading && (
        <ActivityIndicator size="small" color="#4CAF50" style={styles.spinner} />
      )}

      <Text style={styles.progressText}>{(progress * 100).toFixed(1)}%</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => startDownload(false)}
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

      <TouchableOpacity
        style={[styles.button, styles.checkButton]}
        onPress={checkFile}
      >
        <Text style={styles.buttonText}>Verificar Archivo en Celular</Text>
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  status: {
    fontSize: 15,
    marginBottom: 10,
    textAlign: 'center',
  },
  spinner: {
    marginVertical: 10,
  },
  progressText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginVertical: 15,
  },
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
  resumeButton: {
    backgroundColor: '#FF9800',
  },
  checkButton: {
    backgroundColor: '#607D8B',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
