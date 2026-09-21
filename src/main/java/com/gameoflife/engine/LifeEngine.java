package com.gameoflife.engine;

public final class LifeEngine {

    public static final int WALL_WIDTH = 2;
    public static final int WALL_MODE_TORUS = 0;
    public static final int WALL_MODE_ABSORBING = 1;
    public static final int WALL_MODE_ELASTIC = 2;

    private LifeEngine() {
    }

    public static boolean[][] nextGeneration(boolean[][] grid) {
        return nextGeneration(grid, WALL_MODE_TORUS);
    }

    public static boolean[][] nextGeneration(boolean[][] grid, boolean wallMode) {
        return nextGeneration(grid, wallMode ? WALL_MODE_ABSORBING : WALL_MODE_TORUS);
    }

    public static boolean[][] nextGeneration(boolean[][] grid, int wallMode) {
        int rows = grid.length;
        int cols = grid[0].length;
        boolean[][] next = new boolean[rows][cols];
        boolean isWallBoundary = wallMode == WALL_MODE_ABSORBING || wallMode == WALL_MODE_ELASTIC;

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (wallMode == WALL_MODE_ABSORBING && isWall(r, c, rows, cols)) {
                    next[r][c] = false;
                    continue;
                }
                int neighbors = countNeighbors(grid, r, c, isWallBoundary);
                if (grid[r][c]) {
                    next[r][c] = neighbors == 2 || neighbors == 3;
                } else {
                    next[r][c] = neighbors == 3;
                }
            }
        }

        if (wallMode == WALL_MODE_ELASTIC) {
            applyElasticBounce(next, rows, cols);
        }

        return next;
    }

    public static boolean isWall(int r, int c, int rows, int cols) {
        return r < WALL_WIDTH || r >= rows - WALL_WIDTH || c < WALL_WIDTH || c >= cols - WALL_WIDTH;
    }

    public static int countLiveCells(boolean[][] grid) {
        int live = 0;
        for (boolean[] row : grid) {
            for (boolean cell : row) {
                if (cell) {
                    live++;
                }
            }
        }
        return live;
    }

    static int countNeighbors(boolean[][] grid, int row, int col) {
        return countNeighbors(grid, row, col, false);
    }

    static int countNeighbors(boolean[][] grid, int row, int col, boolean wallMode) {
        int rows = grid.length;
        int cols = grid[0].length;
        int count = 0;
        for (int dr = -1; dr <= 1; dr++) {
            for (int dc = -1; dc <= 1; dc++) {
                if (dr == 0 && dc == 0) {
                    continue;
                }
                int nr = row + dr;
                int nc = col + dc;
                if (wallMode) {
                    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
                        continue;
                    }
                    if (isWall(nr, nc, rows, cols)) {
                        continue;
                    }
                } else {
                    nr = Math.floorMod(nr, rows);
                    nc = Math.floorMod(nc, cols);
                }
                if (grid[nr][nc]) {
                    count++;
                }
            }
        }
        return count;
    }

    public static void applyElasticBounce(boolean[][] grid, int rows, int cols) {
        boolean[][] visited = new boolean[rows][cols];
        java.util.List<java.util.List<int[]>> components = new java.util.ArrayList<>();

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (grid[r][c] && !visited[r][c]) {
                    java.util.List<int[]> comp = new java.util.ArrayList<>();
                    java.util.ArrayDeque<int[]> queue = new java.util.ArrayDeque<>();
                    visited[r][c] = true;
                    queue.add(new int[]{r, c});
                    comp.add(new int[]{r, c});

                    while (!queue.isEmpty()) {
                        int[] curr = queue.poll();
                        int cr = curr[0];
                        int cc = curr[1];
                        for (int dr = -1; dr <= 1; dr++) {
                            for (int dc = -1; dc <= 1; dc++) {
                                if (dr == 0 && dc == 0) continue;
                                int nr = cr + dr;
                                int nc = cc + dc;
                                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                                    if (grid[nr][nc] && !visited[nr][nc]) {
                                        visited[nr][nc] = true;
                                        queue.add(new int[]{nr, nc});
                                        comp.add(new int[]{nr, nc});
                                    }
                                }
                            }
                        }
                    }
                    components.add(comp);
                }
            }
        }

        for (java.util.List<int[]> comp : components) {
            int minR = Integer.MAX_VALUE;
            int maxR = Integer.MIN_VALUE;
            int minC = Integer.MAX_VALUE;
            int maxC = Integer.MIN_VALUE;

            for (int[] p : comp) {
                minR = Math.min(minR, p[0]);
                maxR = Math.max(maxR, p[0]);
                minC = Math.min(minC, p[1]);
                maxC = Math.max(maxC, p[1]);
            }

            boolean hitTop = minR < WALL_WIDTH;
            boolean hitBottom = maxR >= rows - WALL_WIDTH;
            boolean hitLeft = minC < WALL_WIDTH;
            boolean hitRight = maxC >= cols - WALL_WIDTH;

            if (hitTop || hitBottom || hitLeft || hitRight) {
                for (int[] p : comp) {
                    grid[p[0]][p[1]] = false;
                }

                int hSpan = maxR - minR;
                int wSpan = maxC - minC;

                for (int[] p : comp) {
                    int r = p[0];
                    int c = p[1];
                    int nr = r;
                    int nc = c;

                    if (hitBottom) {
                        nr = (rows - WALL_WIDTH - 1 - hSpan) + (maxR - r) - 1;
                    } else if (hitTop) {
                        nr = WALL_WIDTH + 1 + (maxR - r);
                    }

                    if (hitRight) {
                        nc = (cols - WALL_WIDTH - 1 - wSpan) + (maxC - c) - 1;
                    } else if (hitLeft) {
                        nc = WALL_WIDTH + 1 + (maxC - c);
                    }

                    int clampedR = Math.max(WALL_WIDTH, Math.min(rows - WALL_WIDTH - 1, nr));
                    int clampedC = Math.max(WALL_WIDTH, Math.min(cols - WALL_WIDTH - 1, nc));
                    grid[clampedR][clampedC] = true;
                }
            }
        }
    }
}
