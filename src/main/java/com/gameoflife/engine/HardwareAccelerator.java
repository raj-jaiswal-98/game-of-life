package com.gameoflife.engine;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Probes and manages hardware acceleration in Docker and host environments.
 * Detects whether GPU compute (NVIDIA / DRI / OpenCL) is available to the container,
 * with an automatic, seamless fallback to CPU multi-threading.
 */
public final class HardwareAccelerator {

    private static final boolean GPU_AVAILABLE;
    private static final String DEVICE_NAME;

    static {
        DetectionResult result = probeHardware();
        GPU_AVAILABLE = result.gpuDetected;
        DEVICE_NAME = result.deviceName;
    }

    private HardwareAccelerator() {
    }

    public static boolean isGpuAvailable() {
        return GPU_AVAILABLE;
    }

    public static String getDeviceName() {
        return DEVICE_NAME;
    }

    public static int getAvailableProcessors() {
        return Runtime.getRuntime().availableProcessors();
    }

    private static DetectionResult probeHardware() {
        // 1. Check NVIDIA driver files in Linux /proc or /dev
        File nvidiaDev = new File("/dev/nvidia0");
        File nvidiaProc = new File("/proc/driver/nvidia/version");
        File driDev = new File("/dev/dri");

        if (nvidiaDev.exists() || nvidiaProc.exists()) {
            String details = readNvidiaVersion(nvidiaProc);
            return new DetectionResult(true, "NVIDIA Hardware Accelerator (" + details + ")");
        }

        // 2. Try executing nvidia-smi if available in PATH
        try {
            Process process = new ProcessBuilder("nvidia-smi", "--query-gpu=name", "--format=csv,noheader")
                    .redirectErrorStream(true)
                    .start();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line = reader.readLine();
                if (line != null && !line.isBlank()) {
                    return new DetectionResult(true, "NVIDIA " + line.trim());
                }
            }
        } catch (Exception ignored) {
            // nvidia-smi not available
        }

        // 3. Check for generic DRI (Direct Rendering Infrastructure) GPU devices
        if (driDev.exists() && driDev.isDirectory()) {
            File[] files = driDev.listFiles();
            if (files != null && files.length > 0) {
                return new DetectionResult(true, "DRI Hardware Graphics Device (" + files[0].getName() + ")");
            }
        }

        // 4. Check NVIDIA container environment variables
        String envNvidia = System.getenv("NVIDIA_VISIBLE_DEVICES");
        if (envNvidia != null && !envNvidia.equalsIgnoreCase("void") && !envNvidia.equalsIgnoreCase("none")) {
            return new DetectionResult(true, "Container GPU Device (" + envNvidia + ")");
        }

        // Fallback to CPU Multi-core
        int cores = Runtime.getRuntime().availableProcessors();
        return new DetectionResult(false, "CPU Multi-Core (" + cores + " parallel worker threads)");
    }

    private static String readNvidiaVersion(File versionFile) {
        if (versionFile.exists()) {
            try {
                String content = Files.readString(Path.of(versionFile.getPath()));
                if (content.contains("NVRM version:")) {
                    int start = content.indexOf("NVRM version:") + 13;
                    int end = content.indexOf("\n", start);
                    if (end > start) {
                        return content.substring(start, end).trim();
                    }
                }
            } catch (Exception ignored) {
            }
        }
        return "NVIDIA Driver Connected";
    }

    private record DetectionResult(boolean gpuDetected, String deviceName) {
    }
}
