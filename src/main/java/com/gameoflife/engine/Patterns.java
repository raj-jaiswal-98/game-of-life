package com.gameoflife.engine;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class Patterns {

    public record Offset(int row, int col) {
    }

    public record Pattern(String id, String name, String description, List<Offset> cells) {
    }

    private static final Map<String, Pattern> CATALOG = new LinkedHashMap<>();

    static {
        register("glider", "Glider", "Small spaceship that travels diagonally", List.of(
                o(0, 1), o(1, 2), o(2, 0), o(2, 1), o(2, 2)
        ));
        register("lwss", "Lightweight spaceship", "Orthogonal spaceship", List.of(
                o(0, 1), o(0, 4),
                o(1, 0),
                o(2, 0), o(2, 4),
                o(3, 0), o(3, 1), o(3, 2), o(3, 3)
        ));
        register("blinker", "Blinker", "Period-2 oscillator", List.of(
                o(0, 0), o(0, 1), o(0, 2)
        ));
        register("toad", "Toad", "Period-2 oscillator", List.of(
                o(0, 1), o(0, 2), o(0, 3),
                o(1, 0), o(1, 1), o(1, 2)
        ));
        register("beacon", "Beacon", "Period-2 oscillator", List.of(
                o(0, 0), o(0, 1),
                o(1, 0), o(1, 1),
                o(2, 2), o(2, 3),
                o(3, 2), o(3, 3)
        ));
        register("pulsar", "Pulsar", "Period-3 oscillator", pulsar());
        register("pentadecathlon", "Pentadecathlon", "Period-15 oscillator", List.of(
                o(0, 1), o(1, 1), o(2, 0), o(2, 2), o(3, 1), o(4, 1),
                o(5, 1), o(6, 1), o(7, 0), o(7, 2), o(8, 1), o(9, 1)
        ));
        register("block", "Block", "Still life 2x2 square", List.of(
                o(0, 0), o(0, 1), o(1, 0), o(1, 1)
        ));
        register("beehive", "Beehive", "Still life", List.of(
                o(0, 1), o(0, 2),
                o(1, 0), o(1, 3),
                o(2, 1), o(2, 2)
        ));
        register("gosper", "Gosper glider gun", "Emits a glider every 30 generations", gosper());
    }

    private Patterns() {
    }

    public static Pattern get(String id) {
        return CATALOG.get(id.toLowerCase());
    }

    public static Set<String> ids() {
        return CATALOG.keySet();
    }

    public static List<Pattern> all() {
        return List.copyOf(CATALOG.values());
    }

    private static void register(String id, String name, String description, List<Offset> cells) {
        CATALOG.put(id, new Pattern(id, name, description, cells));
    }

    private static Offset o(int row, int col) {
        return new Offset(row, col);
    }

    private static List<Offset> pulsar() {
        int[][] points = {
                {0, 2}, {0, 3}, {0, 4}, {0, 8}, {0, 9}, {0, 10},
                {2, 0}, {2, 5}, {2, 7}, {2, 12},
                {3, 0}, {3, 5}, {3, 7}, {3, 12},
                {4, 0}, {4, 5}, {4, 7}, {4, 12},
                {5, 2}, {5, 3}, {5, 4}, {5, 8}, {5, 9}, {5, 10},
                {7, 2}, {7, 3}, {7, 4}, {7, 8}, {7, 9}, {7, 10},
                {8, 0}, {8, 5}, {8, 7}, {8, 12},
                {9, 0}, {9, 5}, {9, 7}, {9, 12},
                {10, 0}, {10, 5}, {10, 7}, {10, 12},
                {12, 2}, {12, 3}, {12, 4}, {12, 8}, {12, 9}, {12, 10}
        };
        return toOffsets(points);
    }

    private static List<Offset> gosper() {
        int[][] points = {
                {0, 24},
                {1, 22}, {1, 24},
                {2, 12}, {2, 13}, {2, 20}, {2, 21}, {2, 34}, {2, 35},
                {3, 11}, {3, 15}, {3, 20}, {3, 21}, {3, 34}, {3, 35},
                {4, 0}, {4, 1}, {4, 10}, {4, 16}, {4, 20}, {4, 21},
                {5, 0}, {5, 1}, {5, 10}, {5, 14}, {5, 16}, {5, 17}, {5, 22}, {5, 24},
                {6, 10}, {6, 16}, {6, 24},
                {7, 11}, {7, 15},
                {8, 12}, {8, 13}
        };
        return toOffsets(points);
    }

    private static List<Offset> toOffsets(int[][] points) {
        return java.util.Arrays.stream(points)
                .map(p -> new Offset(p[0], p[1]))
                .toList();
    }
}
