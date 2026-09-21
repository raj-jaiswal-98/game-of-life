package com.gameoflife.api.dto;

public record HardwareInfo(
        boolean gpuAvailable,
        String deviceName,
        int cpuCores,
        String os,
        String javaVersion
) {
}
