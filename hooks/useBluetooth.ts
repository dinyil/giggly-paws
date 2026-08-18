/**
 * useBluetooth.ts — Web Bluetooth Hook for Thermal Printers
 *
 * Handles connecting to a Bluetooth thermal printer (BLE) from Chrome Android
 * and sending raw ESC/POS byte arrays.
 *
 * Supports the most common BLE UART service UUIDs used by Chinese thermal printers:
 * - 0000ff00 (Generic BLE Serial)
 * - 6e400001 (Nordic UART Service / NUS)
 * - 000018f0 (Another common thermal printer service)
 */

import { useState, useRef, useCallback } from 'react';

// ── Common BLE Service/Characteristic UUIDs for Thermal Printers ─────────

// Services to scan for (we try all of them)
const KNOWN_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',  // Common Chinese thermal printers
  '0000ff00-0000-1000-8000-00805f9b34fb',  // Generic BLE serial
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (NUS)
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Another common one
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip BM70
];

// Write characteristics to try (in priority order)
const KNOWN_WRITE_CHARS = [
  '00002af1-0000-1000-8000-00805f9b34fb',  // 18f0 service write
  '0000ff02-0000-1000-8000-00805f9b34fb',  // ff00 service write
  '6e400002-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART TX
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f', // e7810a71 write
  '49535343-8841-43f4-a8d4-ecbe34729bb3', // Microchip write
];

// Chunk size for BLE writes (MTU - 3 bytes overhead, safe default: 512)
const CHUNK_SIZE = 512;

export interface BluetoothState {
  isConnected: boolean;
  isConnecting: boolean;
  isPrinting: boolean;
  deviceName: string | null;
  error: string | null;
  isSupported: boolean;
}

export function useBluetooth() {
  const deviceRef      = useRef<BluetoothDevice | null>(null);
  const charRef        = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const serverRef      = useRef<BluetoothRemoteGATTServer | null>(null);

  const [state, setState] = useState<BluetoothState>({
    isConnected:  false,
    isConnecting: false,
    isPrinting:   false,
    deviceName:   null,
    error:        null,
    isSupported:  typeof navigator !== 'undefined' && 'bluetooth' in navigator,
  });

  const setPartial = (partial: Partial<BluetoothState>) =>
    setState(prev => ({ ...prev, ...partial }));

  /** Disconnect from printer */
  const disconnect = useCallback(() => {
    if (serverRef.current?.connected) {
      serverRef.current.disconnect();
    }
    deviceRef.current  = null;
    charRef.current    = null;
    serverRef.current  = null;
    setPartial({ isConnected: false, deviceName: null, error: null });
  }, []);

  /** Connect to Bluetooth printer — shows device picker */
  const connect = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      setPartial({ error: 'Web Bluetooth is not supported in this browser. Use Chrome on Android.' });
      return false;
    }

    setPartial({ isConnecting: true, error: null });

    try {
      // Request device — show picker with all known thermal printer services
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: KNOWN_SERVICES,
      });

      device.addEventListener('gattserverdisconnected', () => {
        setPartial({ isConnected: false, deviceName: null });
      });

      deviceRef.current = device;
      setPartial({ deviceName: device.name || 'Thermal Printer' });

      // Connect GATT server
      const server = await device.gatt!.connect();
      serverRef.current = server;

      // Try each known service until one works
      let writeChar: BluetoothRemoteGATTCharacteristic | null = null;

      for (const serviceUUID of KNOWN_SERVICES) {
        try {
          const service = await server.getPrimaryService(serviceUUID);
          // Try each known write characteristic
          for (const charUUID of KNOWN_WRITE_CHARS) {
            try {
              const char = await service.getCharacteristic(charUUID);
              // Verify it's writable
              if (char.properties.write || char.properties.writeWithoutResponse) {
                writeChar = char;
                break;
              }
            } catch {
              // Try next characteristic
            }
          }
          if (writeChar) break;

          // If no known char, enumerate all characteristics and find writable one
          if (!writeChar) {
            try {
              const chars = await service.getCharacteristics();
              for (const c of chars) {
                if (c.properties.write || c.properties.writeWithoutResponse) {
                  writeChar = c;
                  break;
                }
              }
            } catch { /* ignore */ }
          }
          if (writeChar) break;
        } catch {
          // Service not found, try next
        }
      }

      if (!writeChar) {
        throw new Error('Could not find a writable characteristic on this printer. The printer may not support BLE printing.');
      }

      charRef.current = writeChar;
      setPartial({ isConnected: true, isConnecting: false, error: null, deviceName: device.name || 'Thermal Printer' });
      return true;

    } catch (err: any) {
      const msg = err?.message || 'Connection failed';
      if (msg.includes('User cancelled') || msg.includes('chooser')) {
        // User dismissed the picker — not an error
        setPartial({ isConnecting: false, error: null });
      } else {
        setPartial({ isConnecting: false, error: msg });
      }
      return false;
    }
  }, [state.isSupported]);

  /** Send raw bytes to printer in chunks */
  const print = useCallback(async (data: Uint8Array): Promise<boolean> => {
    if (!charRef.current) {
      setPartial({ error: 'Not connected. Please connect to a printer first.' });
      return false;
    }

    setPartial({ isPrinting: true, error: null });

    try {
      // Re-connect if disconnected
      if (!serverRef.current?.connected) {
        const server = await deviceRef.current!.gatt!.connect();
        serverRef.current = server;
      }

      const useWriteWithoutResponse = charRef.current.properties.writeWithoutResponse
        && !charRef.current.properties.write;

      // Send in chunks (BLE has MTU limits)
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        if (useWriteWithoutResponse) {
          await charRef.current.writeValueWithoutResponse(chunk);
        } else {
          await charRef.current.writeValue(chunk);
        }
        // Small delay between chunks to avoid buffer overflow
        if (i + CHUNK_SIZE < data.length) {
          await new Promise(r => setTimeout(r, 20));
        }
      }

      setPartial({ isPrinting: false });
      return true;

    } catch (err: any) {
      setPartial({ isPrinting: false, error: err?.message || 'Print failed' });
      return false;
    }
  }, []);

  return { state, connect, disconnect, print };
}
