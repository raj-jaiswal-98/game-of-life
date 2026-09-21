package com.gameoflife.api.dto;

public record PaintRequest(int row, int col, boolean alive) {
}
